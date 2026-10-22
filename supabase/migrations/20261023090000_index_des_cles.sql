-- Index des clés étrangères qui servent aux suppressions (audit du 2026-10-23).
--
-- Retirer un joueur à la Salle efface ses réponses au quiz et vide `passages.joueur_designe_id`
-- et `photos.envoyee_par` ; retirer une équipe ou un groupe touche ses mises, ses passages et ses
-- compteurs. Sans index, chacune de ces suppressions parcourt la table entière, toutes soirées
-- confondues. Les autres clés sans index (référentiels, contenus jamais supprimés) n'en ont pas
-- besoin.

create index if not exists reponses_quiz_joueur_idx on public.reponses_quiz (joueur_id);
create index if not exists passages_joueur_designe_idx on public.passages (joueur_designe_id)
  where joueur_designe_id is not null;
create index if not exists passages_equipe_idx on public.passages (equipe_id)
  where equipe_id is not null;
create index if not exists photos_envoyee_par_idx on public.photos (envoyee_par)
  where envoyee_par is not null;
create index if not exists mises_quiz_equipe_idx on public.mises_quiz (equipe_id);
create index if not exists scores_manche_idx on public.scores (manche_id)
  where manche_id is not null;
create index if not exists equipes_groupes_groupe_idx on public.equipes_groupes (groupe_id);
