-- Socle : qui anime, quel événement, quelles équipes, quels joueurs.
--
-- Deux publics, deux régimes d'accès :
--   * animateurs et admins passent par Supabase Auth et sont soumis aux policies ci-dessous ;
--   * les joueurs n'ont aucun compte et aucune clé : ils n'apparaissent jamais dans une policy.
--     Leurs lectures et écritures passent par des fonctions `security definer` (migration 0005),
--     appelées par le serveur de l'app. `anon` ne doit donc rien pouvoir lire ici.

create type public.role_animateur as enum ('animateur', 'admin');
create type public.statut_evenement as enum ('preparation', 'repetition', 'en_cours', 'termine');
create type public.langue as enum ('fr', 'en', 'ta');
create type public.type_client as enum ('particulier', 'entreprise');

-- ---------------------------------------------------------------------------
-- Animateurs et admins
-- ---------------------------------------------------------------------------

create table public.animateurs (
  id uuid primary key references auth.users (id) on delete cascade,
  nom text not null check (char_length(nom) between 1 and 100),
  role public.role_animateur not null default 'animateur',
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

comment on table public.animateurs is
  'Comptes Team Up!. Un compte désactivé (actif = false) ne peut plus rien lire.';

-- `security definer` : ces fonctions servent dans les policies de `animateurs` elle-même,
-- elles ne doivent donc pas repasser par la RLS de cette table.
create function public.est_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.animateurs a
    where a.id = (select auth.uid()) and a.actif and a.role = 'admin'
  );
$$;

create function public.est_animateur() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.animateurs a where a.id = (select auth.uid()) and a.actif
  );
$$;

alter table public.animateurs enable row level security;

create policy "animateur lit sa fiche" on public.animateurs
  for select to authenticated
  using (id = (select auth.uid()) or public.est_admin());

create policy "admin crée un animateur" on public.animateurs
  for insert to authenticated
  with check (public.est_admin());

create policy "admin modifie un animateur" on public.animateurs
  for update to authenticated
  using (public.est_admin())
  with check (public.est_admin());

-- ---------------------------------------------------------------------------
-- Événements
-- ---------------------------------------------------------------------------

create table public.evenements (
  id uuid primary key default gen_random_uuid(),
  -- Code de salle tapé à la main : 6 caractères, sans I, O, 0 ni 1 (confusions en salle sombre).
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  animateur_id uuid not null references public.animateurs (id) on delete restrict,
  client_nom text not null check (char_length(client_nom) between 1 and 200),
  type_client public.type_client not null default 'particulier',
  occasion text,
  date_evenement date not null,
  lieu text,
  creneau_minutes integer not null check (creneau_minutes between 10 and 240),
  langues public.langue[] not null default '{fr}'::public.langue[]
    check (array_length(langues, 1) between 1 and 3),
  statut public.statut_evenement not null default 'preparation',
  -- Clôture des envois photo : posée par la régie ou par le lancement de la diffusion.
  photos_closes_le timestamptz,
  commence_le timestamptz,
  termine_le timestamptz,
  -- Passé cette date, le code de salle ne laisse plus entrer personne.
  code_expire_le timestamptz,
  cree_le timestamptz not null default now()
);

create index evenements_animateur_idx on public.evenements (animateur_id);

alter table public.evenements enable row level security;

create policy "animateur lit ses événements" on public.evenements
  for select to authenticated
  using (animateur_id = (select auth.uid()) or public.est_admin());

create policy "animateur crée un événement" on public.evenements
  for insert to authenticated
  with check (public.est_animateur() and animateur_id = (select auth.uid()));

create policy "animateur modifie ses événements" on public.evenements
  for update to authenticated
  using (animateur_id = (select auth.uid()) or public.est_admin())
  with check (animateur_id = (select auth.uid()) or public.est_admin());

create policy "animateur supprime ses événements" on public.evenements
  for delete to authenticated
  using (animateur_id = (select auth.uid()) or public.est_admin());

-- Dépend de `evenements`, donc définie après elle.
create function public.anime(p_evenement uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evenements e
    join public.animateurs a on a.id = (select auth.uid())
    where e.id = p_evenement and a.actif and (e.animateur_id = a.id or a.role = 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- Équipes
-- ---------------------------------------------------------------------------

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  -- Le numéro porte la couleur : --tu-team-1 à --tu-team-8 dans les tokens.
  numero smallint not null check (numero between 1 and 8),
  nom text not null check (char_length(nom) between 1 and 60),
  cree_le timestamptz not null default now(),
  unique (evenement_id, numero),
  -- Sert de cible aux clés étrangères composites : une équipe reste dans son événement.
  unique (id, evenement_id)
);

create index equipes_evenement_idx on public.equipes (evenement_id);

alter table public.equipes enable row level security;

create policy "animateur lit les équipes de ses événements" on public.equipes
  for select to authenticated
  using (public.anime(evenement_id));

create policy "animateur écrit les équipes de ses événements" on public.equipes
  for all to authenticated
  using (public.anime(evenement_id))
  with check (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Joueurs (anonymes : prénom seul, aucune donnée de contact)
-- ---------------------------------------------------------------------------

create table public.joueurs (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  equipe_id uuid,
  prenom text not null check (char_length(prenom) between 1 and 40),
  langue public.langue not null default 'fr',
  -- SHA-256 du jeton de session. Le jeton lui-même ne touche jamais la base :
  -- il vit dans un cookie httpOnly, l'app hache avant d'interroger.
  jeton_hash text not null unique check (jeton_hash ~ '^[0-9a-f]{64}$'),
  capitaine boolean not null default false,
  rejoint_le timestamptz not null default now(),
  vu_le timestamptz not null default now(),
  -- Supprimer une équipe laisse ses joueurs dans l'événement, sans équipe.
  foreign key (equipe_id, evenement_id)
    references public.equipes (id, evenement_id) on delete set null (equipe_id)
);

create index joueurs_evenement_idx on public.joueurs (evenement_id);
create index joueurs_equipe_idx on public.joueurs (equipe_id);

-- Un seul capitaine par équipe : c'est lui qui envoie les photos.
create unique index joueurs_capitaine_unique on public.joueurs (equipe_id) where capitaine;

alter table public.joueurs enable row level security;

create policy "animateur lit les joueurs de ses événements" on public.joueurs
  for select to authenticated
  using (public.anime(evenement_id));

create policy "animateur écrit les joueurs de ses événements" on public.joueurs
  for all to authenticated
  using (public.anime(evenement_id))
  with check (public.anime(evenement_id));

comment on column public.joueurs.jeton_hash is
  'SHA-256 hexadécimal du jeton de session. Aucun jeton en clair en base.';
