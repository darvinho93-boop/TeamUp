-- Le logo de la soirée (2026-10-17).
--
-- Un monogramme (« V | M ») et un titre (« Vinoyan & Mélanie »), saisis à la Salle sous la
-- session de l'animateur (policy « animateur modifie ses événements »). L'écran commun révèle le
-- monogramme, le déploie en titre et le pose dans un bandeau en haut de la page du QR code.
-- Rien n'est propre au mariage : « 30 » et « Les 30 ans de Léa », « TU » et « Séminaire Acme ».

-- Une à trois parties, d'un à trois caractères chacune (une contrainte ne peut pas porter de
-- sous-requête : d'où cette fonction immuable).
create function public.monogramme_valide(p_initiales text[]) returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(p_initiales, 1) between 1 and 3, false)
    and coalesce(bool_and(char_length(btrim(i)) between 1 and 3), false)
  from unnest(p_initiales) as i;
$$;

alter table public.evenements
  add column logo_initiales text[],
  add column logo_titre text,
  add constraint evenements_logo_initiales_forme check (
    logo_initiales is null or public.monogramme_valide(logo_initiales)
  ),
  add constraint evenements_logo_titre_forme check (
    logo_titre is null or char_length(btrim(logo_titre)) between 1 and 60
  ),
  add constraint evenements_logo_complet check ((logo_initiales is null) = (logo_titre is null));

comment on column public.evenements.logo_initiales is
  'Monogramme de la soirée, de une à trois parties (« V », « M »).';
comment on column public.evenements.logo_titre is
  'Titre que le monogramme devient à l''écran (« Vinoyan & Mélanie »).';

-- Une nouvelle soirée démarre sur l'ouverture ; les soirées existantes restent où elles sont.
alter table public.pilotage alter column scene set default 'ouverture';

-- `etat_ecran`, reprise telle quelle de 20261017100000_salle_et_ecran.sql, avec
-- `evenement.logo` en plus. Les droits sont conservés (`create or replace`).
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
      'photos_closes', e.photos_closes_le is not null,
      'logo', case when e.logo_initiales is null then null else jsonb_build_object(
        'initiales', to_jsonb(e.logo_initiales), 'titre', e.logo_titre
      ) end
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
