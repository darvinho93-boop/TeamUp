-- Le programme d'une soirée et ses scores.
--
-- Les jeux sont un référentiel figé : les cinq jeux socles et les deux duels en bêta de la
-- spec v3, rien d'autre. Personne ne peut en ajouter depuis l'app, même un admin.
--
-- Les scores sont un journal : on n'écrase jamais une ligne, une correction en ajoute une.
-- C'est ce qui donne l'« historique des corrections » attendu par la régie.

create type public.jeu as enum ('list2', 'qcm2', 'enchere2', 'mime2', 'photo2', 'grab', 'cup');
create type public.statut_manche as enum ('a_venir', 'en_cours', 'terminee', 'annulee');
create type public.statut_passage as enum ('a_venir', 'en_cours', 'termine');

-- ---------------------------------------------------------------------------
-- Référentiel des jeux (spec v3)
-- ---------------------------------------------------------------------------

create table public.jeux (
  code public.jeu primary key,
  nom text not null,
  -- Séquentiel = un passage par équipe, donc un coût en minutes proportionnel au nombre d'équipes.
  sequentiel boolean not null,
  -- Chrono de passage en secondes, tel qu'affiché dans la spec ; null quand la durée dépend
  -- du contenu (nombre de questions, de thèmes).
  chrono_passage_s integer check (chrono_passage_s > 0),
  beta boolean not null default false,
  ordre_affichage smallint not null unique
);

insert into public.jeux (code, nom, sequentiel, chrono_passage_s, beta, ordre_affichage) values
  ('list2', 'Points communs', true, 130, false, 1),
  ('qcm2', 'Quiz', false, 30, false, 2),
  ('enchere2', 'Surenchère', false, 120, false, 3),
  ('mime2', 'Mime', true, 150, false, 4),
  ('photo2', 'Photo challenge', false, 300, false, 5),
  ('grab', 'Attrape l''objet', false, 30, true, 6),
  ('cup', 'Tête, épaule, gobelet', false, 45, true, 7);

alter table public.jeux enable row level security;

-- Lisible par tous les comptes, modifiable par personne : il faut une migration pour y toucher.
create policy "référentiel lisible" on public.jeux
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Manches (le programme de la soirée)
-- ---------------------------------------------------------------------------

create table public.manches (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  jeu public.jeu not null references public.jeux (code),
  ordre smallint not null check (ordre between 1 and 20),
  -- Ce qui varie d'une soirée à l'autre sans changer le schéma : mode du quiz
  -- (croix ou téléphone), nombre de questions et repêchage éventuel, nombre de thèmes.
  options jsonb not null default '{}'::jsonb,
  statut public.statut_manche not null default 'a_venir',
  commence_le timestamptz,
  termine_le timestamptz,
  cree_le timestamptz not null default now(),
  unique (evenement_id, ordre),
  unique (id, evenement_id)
);

create index manches_evenement_idx on public.manches (evenement_id);

alter table public.manches enable row level security;

create policy "animateur lit les manches de ses événements" on public.manches
  for select to authenticated
  using (public.anime(evenement_id));

create policy "animateur écrit les manches de ses événements" on public.manches
  for all to authenticated
  using (public.anime(evenement_id))
  with check (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Passages (une équipe qui joue, ou un thème qu'on dévoile)
-- ---------------------------------------------------------------------------

create table public.passages (
  id uuid primary key default gen_random_uuid(),
  manche_id uuid not null,
  -- Dénormalisé : les policies et les clés composites travaillent par événement.
  evenement_id uuid not null,
  -- Null quand le passage ne vise pas une équipe (un thème de surenchère, une question de quiz).
  equipe_id uuid,
  ordre smallint not null check (ordre between 1 and 40),
  -- Le seul joueur autorisé à voir le secret du passage : J1 du mime, champion de surenchère.
  joueur_designe_id uuid references public.joueurs (id) on delete set null,
  statut public.statut_passage not null default 'a_venir',
  -- Palier atteint, temps restant, survivants par équipe : la forme dépend du jeu.
  resultat jsonb not null default '{}'::jsonb,
  points integer,
  commence_le timestamptz,
  termine_le timestamptz,
  unique (manche_id, ordre),
  unique (id, evenement_id),
  foreign key (manche_id, evenement_id)
    references public.manches (id, evenement_id) on delete cascade,
  foreign key (equipe_id, evenement_id)
    references public.equipes (id, evenement_id) on delete set null (equipe_id)
);

create index passages_manche_idx on public.passages (manche_id);
create index passages_evenement_idx on public.passages (evenement_id);

alter table public.passages enable row level security;

create policy "animateur lit les passages de ses événements" on public.passages
  for select to authenticated
  using (public.anime(evenement_id));

create policy "animateur écrit les passages de ses événements" on public.passages
  for all to authenticated
  using (public.anime(evenement_id))
  with check (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Scores (journal append-only)
-- ---------------------------------------------------------------------------

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  equipe_id uuid not null,
  -- Null pour une correction manuelle ou un bonus hors manche.
  manche_id uuid,
  points integer not null,
  motif text not null check (char_length(motif) between 1 and 200),
  saisi_par uuid references public.animateurs (id) on delete set null,
  cree_le timestamptz not null default now(),
  foreign key (equipe_id, evenement_id)
    references public.equipes (id, evenement_id) on delete cascade,
  foreign key (manche_id, evenement_id)
    references public.manches (id, evenement_id) on delete set null (manche_id)
);

create index scores_evenement_idx on public.scores (evenement_id);
create index scores_equipe_idx on public.scores (equipe_id);

alter table public.scores enable row level security;

create policy "animateur lit les scores de ses événements" on public.scores
  for select to authenticated
  using (public.anime(evenement_id));

-- Insertion seulement : ni update ni delete, pour personne. Une erreur se corrige
-- par une ligne de plus, pas par une ligne réécrite.
create policy "animateur ajoute un score" on public.scores
  for insert to authenticated
  with check (public.anime(evenement_id));

comment on table public.scores is
  'Journal des points. Append-only : aucune policy d''update ni de delete, même pour un admin.';

create view public.classement with (security_invoker = on) as
select
  eq.evenement_id,
  eq.id as equipe_id,
  eq.numero,
  eq.nom,
  coalesce(sum(s.points), 0)::integer as points
from public.equipes eq
left join public.scores s on s.equipe_id = eq.id
group by eq.evenement_id, eq.id, eq.numero, eq.nom;

comment on view public.classement is
  'Total par équipe. security_invoker : la vue ne contourne pas la RLS des tables sous-jacentes.';
