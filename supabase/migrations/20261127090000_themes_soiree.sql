-- Thème d'une soirée sur l'écran commun (2026-11-27), pour le mariage du 5 décembre.
--
-- Un thème habille l'écran commun d'une soirée aux couleurs de ses hôtes : le faire-part de leur
-- mariage, leur monogramme, leur musique. Il ne s'active nulle part dans l'app : la ligne s'écrit
-- avec la clé de service (`apps/app/scripts/theme-soiree.mjs`), pour une soirée et ses copies.
-- Les fichiers des hôtes vivent dans un bucket privé, jamais dans le dépôt.

create table public.themes_soiree (
  evenement_id uuid primary key references public.evenements (id) on delete cascade,
  -- Un seul thème pour l'instant ; un autre demandera son code d'affichage.
  theme text not null check (theme in ('faire-part')),
  -- Les chemins des fichiers dans le bucket « themes », par rôle (monogramme, musique…).
  fichiers jsonb not null check (jsonb_typeof(fichiers) = 'object'),
  -- Les textes affichés (la date de la fête, le merci de la clôture) et les réglages de la
  -- musique (l'instant où l'orchestre entre, les notes que soulignent les éclats).
  reglages jsonb not null default '{}'::jsonb check (jsonb_typeof(reglages) = 'object'),
  cree_le timestamptz not null default now()
);

comment on table public.themes_soiree is
  'Thème de l''écran commun d''une soirée. Écrit par la clé de service seule, lu par son animateur.';

alter table public.themes_soiree enable row level security;

-- Lecture : l'animateur de la soirée (et l'admin, par `anime`). Aucune écriture depuis l'app :
-- seule la clé de service, qui ignore la RLS, pose ou retire un thème.
create policy "animateur lit le thème de sa soirée" on public.themes_soiree
  for select to authenticated
  using (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Le bucket
-- ---------------------------------------------------------------------------

-- Privé : ce sont les visuels et la musique des hôtes. L'écran les télécharge par URL signée,
-- sous la session de l'animateur. Tout animateur lit (comme les musiques) : la copie d'une soirée
-- reprend les fichiers de l'originale sans les dupliquer. Personne n'écrit depuis l'app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'themes',
  'themes',
  false,
  20971520,
  array['image/png', 'image/webp', 'image/svg+xml', 'audio/wav', 'audio/x-wav', 'audio/mpeg']
)
on conflict (id) do nothing;

create policy "animateur lit les fichiers des thèmes" on storage.objects
  for select to authenticated
  using (bucket_id = 'themes' and public.est_animateur());
