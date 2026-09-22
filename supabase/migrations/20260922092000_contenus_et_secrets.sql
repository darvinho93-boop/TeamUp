-- Banques de contenus du back-office, traduites dans les langues actives.
--
-- Le point important du lot : la partie publique d'un contenu et sa partie secrète vivent dans
-- deux tables séparées. Une seule table porte des secrets, donc une seule table à verrouiller,
-- et le test automatisé n'a qu'un endroit à surveiller.
--
-- Forme de la charge utile, par jeu :
--   list2    public {consigne}                   secret {reponse, indices: [2]}
--   qcm2     public {question, propositions[4]}  secret {bonne: 0..3}
--   enchere2 public {theme}                      secret {sujet}
--   mime2    public {}                           secret {mot}
--   photo2   public {theme}                      aucun secret

create type public.etiquette as enum ('b2c', 'b2b', 'tout_public');

create table public.contenus (
  id uuid primary key default gen_random_uuid(),
  jeu public.jeu not null references public.jeux (code),
  -- Sert à filtrer à la préparation : une blague de mariage n'a rien à faire dans un séminaire.
  etiquette public.etiquette not null default 'tout_public',
  actif boolean not null default true,
  cree_par uuid references public.animateurs (id) on delete set null,
  cree_le timestamptz not null default now()
);

create index contenus_jeu_idx on public.contenus (jeu) where actif;

create table public.contenus_traductions (
  contenu_id uuid not null references public.contenus (id) on delete cascade,
  langue public.langue not null,
  valeur jsonb not null default '{}'::jsonb check (jsonb_typeof(valeur) = 'object'),
  primary key (contenu_id, langue)
);

create table public.contenus_secrets (
  contenu_id uuid not null references public.contenus (id) on delete cascade,
  langue public.langue not null,
  valeur jsonb not null check (jsonb_typeof(valeur) = 'object'),
  primary key (contenu_id, langue)
);

comment on table public.contenus_secrets is
  'Réponses, indices, sujets de surenchère, mots de mime. Jamais lisible par un joueur : '
  'aucun droit pour anon, et le seul chemin de sortie est public.secret_du_joueur().';

-- Un passage tire son contenu de la banque.
alter table public.passages
  add column contenu_id uuid references public.contenus (id) on delete set null;

-- ---------------------------------------------------------------------------
-- RLS : les contenus appartiennent à Team Up!, pas à un événement.
-- Tout animateur actif les lit (la régie doit voir le mot de mime pour le montrer à J1).
-- Seul un admin les écrit (back-office, lot 9).
-- ---------------------------------------------------------------------------

alter table public.contenus enable row level security;
alter table public.contenus_traductions enable row level security;
alter table public.contenus_secrets enable row level security;

create policy "animateur lit les contenus" on public.contenus
  for select to authenticated
  using (public.est_animateur());

create policy "admin écrit les contenus" on public.contenus
  for all to authenticated
  using (public.est_admin())
  with check (public.est_admin());

create policy "animateur lit les traductions" on public.contenus_traductions
  for select to authenticated
  using (public.est_animateur());

create policy "admin écrit les traductions" on public.contenus_traductions
  for all to authenticated
  using (public.est_admin())
  with check (public.est_admin());

create policy "animateur lit les secrets" on public.contenus_secrets
  for select to authenticated
  using (public.est_animateur());

create policy "admin écrit les secrets" on public.contenus_secrets
  for all to authenticated
  using (public.est_admin())
  with check (public.est_admin());
