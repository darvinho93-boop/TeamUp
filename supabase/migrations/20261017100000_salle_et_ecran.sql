-- La Salle et l'écran des équipes (2026-10-17).
--
-- L'écran commun montre les membres de chaque équipe de deux façons, au choix de l'animateur
-- depuis la Salle : « tous » (tous les prénoms d'un coup, la police s'ajuste) ou « carrousel »
-- (des pages qui tournent, comme depuis le 2026-10-09). Le réglage vit sur la ligne de
-- pilotage, comme le son, et `etat_ecran` le renvoie. Le client tient sans cette migration
-- (mode « tous »).
--
-- Retirer un joueur ou destituer un capitaine ne demande rien de plus : la policy
-- « animateur écrit les joueurs de ses événements » le permet, et les clés étrangères vers
-- `joueurs` sont déjà en cascade (réponses au quiz) ou en `set null` (passages, photos).

alter table public.pilotage
  add column membres_mode text not null default 'tous'
    check (membres_mode in ('tous', 'carrousel'));

-- Comme `regler_son` : ne touche pas à `maj_le` (pas de « pilotage périmé » à la touche
-- suivante). Security invoker : la policy « animateur pilote ses événements » tranche.
create function public.regler_membres(p_evenement uuid, p_mode text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.pilotage
  set membres_mode = p_mode
  where evenement_id = p_evenement;
$$;

revoke execute on function public.regler_membres(uuid, text) from public, anon;
grant execute on function public.regler_membres(uuid, text) to authenticated;

-- `etat_ecran`, reprise telle quelle de 20261010090000_son_de_la_salle.sql, avec la clé
-- `membres_mode` en plus. Les droits sont conservés (`create or replace`).
create or replace function public.etat_ecran(p_code text, p_regie boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'serveur_ms', floor(extract(epoch from clock_timestamp()) * 1000),
    'evenement', jsonb_build_object(
      'id', e.id, 'code', e.code, 'langues', e.langues, 'statut', e.statut,
      'client_nom', e.client_nom, 'creneau_minutes', e.creneau_minutes,
      'photos_closes', e.photos_closes_le is not null
    ),
    'son', jsonb_build_object('actif', pi.son_actif, 'volume', pi.son_volume),
    'membres_mode', pi.membres_mode,
    'pilotage', jsonb_build_object(
      'scene', pi.scene,
      'manche_id', pi.manche_id,
      'passage_id', pi.passage_id,
      'etape', pi.etape,
      'indices', pi.indices,
      'chrono_depart_ms', floor(extract(epoch from pi.chrono_depart) * 1000),
      'chrono_duree_s', pi.chrono_duree_s,
      'version', pi.maj_le
    ),
    'equipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', eq.id,
        'numero', eq.numero,
        'nom', eq.nom,
        'points', coalesce((select sum(s.points) from public.scores s where s.equipe_id = eq.id), 0),
        'joueurs', (select count(*) from public.joueurs j where j.equipe_id = eq.id),
        'prenoms', coalesce((
          select jsonb_agg(j.prenom order by j.rejoint_le)
          from public.joueurs j where j.equipe_id = eq.id), '[]'::jsonb),
        'capitaine', (
          select j.prenom from public.joueurs j
          where j.equipe_id = eq.id and j.capitaine
          order by j.rejoint_le limit 1)
      ) order by eq.numero)
      from public.equipes eq where eq.evenement_id = e.id
    ), '[]'::jsonb),
    'joueurs', (select count(*) from public.joueurs j where j.evenement_id = e.id),
    'connectes', (
      select count(*) from public.joueurs j
      where j.evenement_id = e.id and j.vu_le > now() - interval '30 seconds'
    ),
    'programme', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'jeu', m.jeu,
        'ordre', m.ordre,
        'statut', m.statut,
        'options', m.options,
        -- Mode téléphone seulement : en mode croix, c'est la régie qui compte.
        'survivants', case
          when m.jeu = 'qcm2' and m.options ->> 'mode' = 'telephone'
            then public.survivants_quiz(m.id) end,
        'passages', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', pa.id,
            'ordre', pa.ordre,
            'statut', pa.statut,
            'equipe_id', pa.equipe_id,
            'points', pa.points,
            'resultat', pa.resultat,
            'contenu_id', pa.contenu_id,
            'public', public.contenu_public(pa.contenu_id, e.langues),
            'secret', public.secret_visible(m.jeu, pa, pi, e.langues, p_regie),
            'reponses', case when m.jeu = 'qcm2' then (
              select count(*) from public.reponses_quiz r where r.passage_id = pa.id) end,
            'photos', case
              when m.jeu = 'photo2' and (p_regie or m.statut in ('en_cours', 'terminee')) then
                coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'equipe_id', ph.equipe_id,
                    'chemin', ph.chemin,
                    'envoyee_ms', floor(extract(epoch from ph.envoyee_le) * 1000),
                    'gagnante', ph.gagnante
                  ) order by eq.numero)
                  from public.photos ph
                  join public.equipes eq on eq.id = ph.equipe_id
                  where ph.evenement_id = e.id and ph.theme_id = pa.contenu_id
                ), '[]'::jsonb) end
          ) order by pa.ordre)
          from public.passages pa where pa.manche_id = m.id
        ), '[]'::jsonb)
      ) order by m.ordre)
      from public.manches m where m.evenement_id = e.id
    ), '[]'::jsonb)
  )
  from public.evenements e
  join public.pilotage pi on pi.evenement_id = e.id
  where e.code = upper(p_code);
$$;
