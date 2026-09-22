-- Photo challenge : une photo par thème et par équipe, remplaçable jusqu'à la clôture.
--
-- Les fichiers vivent dans un bucket privé. Personne ne les lit directement : l'app fabrique
-- des URL signées côté serveur, et les envois passent par le serveur avec le jeton du capitaine.

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  equipe_id uuid not null,
  -- Le thème est un contenu de la banque photo2.
  theme_id uuid not null references public.contenus (id) on delete restrict,
  -- Chemin dans le bucket : {evenement_id}/{equipe_id}/{id}.jpg
  chemin text not null unique,
  envoyee_par uuid references public.joueurs (id) on delete set null,
  envoyee_le timestamptz not null default now(),
  gagnante boolean not null default false,
  -- Durée de conservation : décision ouverte, la colonne attend sa valeur (lot 8).
  expire_le timestamptz,
  -- Une équipe n'a qu'une photo par thème : un nouvel envoi remplace l'ancienne.
  unique (equipe_id, theme_id),
  foreign key (equipe_id, evenement_id)
    references public.equipes (id, evenement_id) on delete cascade
);

create index photos_evenement_idx on public.photos (evenement_id);

-- Une seule gagnante par thème, aucun vote (spec v3).
create unique index photos_gagnante_unique
  on public.photos (evenement_id, theme_id) where gagnante;

alter table public.photos enable row level security;

create policy "animateur lit les photos de ses événements" on public.photos
  for select to authenticated
  using (public.anime(evenement_id));

create policy "animateur écrit les photos de ses événements" on public.photos
  for all to authenticated
  using (public.anime(evenement_id))
  with check (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Bucket privé
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Lecture réservée à l'animateur de l'événement : le premier dossier du chemin est son id.
-- Les envois et les suppressions passent par le serveur (rôle de service), donc aucune policy.
create policy "animateur lit les photos de son événement" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.anime(((storage.foldername(name))[1])::uuid)
  );
