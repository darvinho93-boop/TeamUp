-- Portrait mystère : une clé propre pour votes_portrait (2026-11-18).
--
-- Sa clé primaire (passage_id, equipe_id, tour) contenait les deux clés étrangères : PostgREST y
-- voyait une table de jonction entre passages et équipes, et toute imbrication `equipes(...)`
-- depuis `passages` (ou l'inverse) devenait ambiguë (PGRST201, vu en CI sur e2e/ordre.spec.ts).
-- Même forme que mots_surenchere : un identifiant pour clé, le trio en contrainte d'unicité, que
-- `on conflict (passage_id, equipe_id, tour)` de voter_portrait et voter_portrait_regie vise
-- toujours.

alter table public.votes_portrait drop constraint votes_portrait_pkey;

alter table public.votes_portrait
  add column id uuid not null default gen_random_uuid() primary key;

alter table public.votes_portrait
  add constraint votes_portrait_passage_equipe_tour_key unique (passage_id, equipe_id, tour);
