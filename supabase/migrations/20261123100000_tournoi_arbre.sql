-- L'arbre du tournoi à l'écran (2026-11-21) : `etat_ecran.tournoi.tableau` porte tout le tableau, plus
-- seulement sa fin. Reprise de 20261123090000_tournoi_gobelet.sql, ce filtre retiré.

-- Security definer avec un seul contrôle d'`anime()` : la RLS le rappellerait à chaque ligne.
create or replace function public.tournoi_ecran(p_evenement uuid, p_pilotage public.pilotage)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ouverte as (
    select m.id, m.options
    from public.manches m
    where m.id = p_pilotage.manche_id
      and m.evenement_id = p_evenement
      and m.jeu = 'cup'
      and m.options ->> 'format' = 'tournoi'
      and public.anime(p_evenement)
  ), bornes as (
    select
      o.id,
      o.options,
      (select max(t.tour) from public.matchs_tournoi t where t.manche_id = o.id) as tours,
      (select max(t.sequence) from public.matchs_tournoi t where t.manche_id = o.id) as numero
    from ouverte o
  )
  select jsonb_build_object(
    'gobelets', b.options -> 'gobelets',
    'joueurs', b.options -> 'joueurs',
    'tours', b.tours,
    'sequence', b.numero,
    'tour', (
      select t.tour from public.matchs_tournoi t
      where t.manche_id = b.id and t.sequence = b.numero limit 1
    ),
    'reste', exists (
      select 1 from public.matchs_tournoi t
      where t.manche_id = b.id and t.gagnant is null and t.sequence is null
    ),
    'en_lice', (b.options ->> 'joueurs')::integer - (
      select count(*) from public.matchs_tournoi t
      where t.manche_id = b.id and t.gagnant is not null and t.prenom_b is not null
    ),
    'matchs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'tour', t.tour, 'rang', t.rang, 'sequence', t.sequence, 'poste', t.poste,
        'a', public.duelliste_json(t.joueur_a, t.prenom_a, t.equipe_a),
        'b', public.duelliste_json(t.joueur_b, t.prenom_b, t.equipe_b),
        'gagnant', t.gagnant
      ) order by t.poste)
      from public.matchs_tournoi t
      where t.manche_id = b.id and t.sequence = b.numero
    ), '[]'::jsonb),
    -- Tout le tableau : l'écran en dessine l'arbre, du premier tour à la finale.
    'tableau', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'tour', t.tour, 'rang', t.rang, 'sequence', t.sequence, 'poste', t.poste,
        'a', public.duelliste_json(t.joueur_a, t.prenom_a, t.equipe_a),
        'b', public.duelliste_json(t.joueur_b, t.prenom_b, t.equipe_b),
        'gagnant', t.gagnant
      ) order by t.tour, t.rang)
      from public.matchs_tournoi t
      where t.manche_id = b.id
    ), '[]'::jsonb)
  )
  from bornes b;
$$;
