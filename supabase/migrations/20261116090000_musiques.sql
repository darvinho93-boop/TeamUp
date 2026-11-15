-- Musique sous les chronos du quiz et de la Surenchère (2026-11-15).
--
-- Une bibliothèque de MP3, déposée au back-office et commune à toutes les soirées. La
-- préparation coche, pour chaque Quiz et chaque Surenchère, celles qui tournent sous les chronos
-- (`manches.options.musiques`, une liste d'identifiants) ; l'écran commun les joue.

-- ---------------------------------------------------------------------------
-- La bibliothèque
-- ---------------------------------------------------------------------------

create table public.musiques (
  id uuid primary key default gen_random_uuid(),
  titre text not null check (char_length(btrim(titre)) between 1 and 80),
  -- Le chemin dans le bucket « musiques » : {uuid}.mp3, un uuid neuf à chaque dépôt.
  chemin text not null unique
    check (chemin ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$'),
  taille integer not null check (taille between 1 and 15728640),
  -- Rien ne se supprime : une musique se désactive, comme un contenu.
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

comment on table public.musiques is
  'MP3 joués sous les chronos par l''écran commun. Écrits par un admin, lus par les animateurs.';

alter table public.musiques enable row level security;

create policy "animateur lit les musiques" on public.musiques
  for select to authenticated
  using (public.est_animateur());

create policy "admin écrit les musiques" on public.musiques
  for all to authenticated
  using (public.est_admin())
  with check (public.est_admin());

-- ---------------------------------------------------------------------------
-- Le bucket
-- ---------------------------------------------------------------------------

-- Privé : ce sont des morceaux protégés. L'écran commun les lit par URL signée, sous la session
-- de l'animateur, comme les photos. MP3 seul, 15 Mo au plus.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('musiques', 'musiques', false, 15728640, array['audio/mpeg'])
on conflict (id) do nothing;

create policy "animateur lit les musiques du bucket" on storage.objects
  for select to authenticated
  using (bucket_id = 'musiques' and public.est_animateur());

create policy "admin dépose une musique" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'musiques'
    and public.est_admin()
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$'
  );

-- Seulement pour défaire un dépôt dont la ligne n'a pas pu s'écrire : une musique enregistrée
-- se désactive, elle ne se supprime pas.
create policy "admin retire un fichier de musique" on storage.objects
  for delete to authenticated
  using (bucket_id = 'musiques' and public.est_admin());
