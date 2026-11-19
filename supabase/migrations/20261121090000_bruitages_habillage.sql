-- Plateau, suite (2026-11-19, audit « jeu télé ») : la boîte à sons de la régie et
-- l'habillage de l'écran commun.
--
-- Bruitage : l'animateur fait jouer un son à l'écran quand il veut (applaudissements,
-- roulements, bonne réponse, raté, buzzer). Le canal `salle:<id>` est public et ne transporte
-- rien : le son demandé s'écrit donc ici, sous la policy de l'animateur, avec l'heure de la base ;
-- l'écran le joue quand il voit cette heure changer (jamais au chargement).
--
-- Habillage : le halo de projecteur et les ronds du logo en fond, que la régie peut retirer pour
-- une soirée. Actif par défaut.
--
-- Comme `regler_son`, ces réglages ne touchent pas à `maj_le` : pas de « pilotage périmé » à la
-- touche suivante. Le client tient sans cette migration (pas de bruitage, habillage actif).

alter table public.pilotage
  add column bruitage jsonb
    check (
      bruitage is null
      or (
        bruitage ->> 'son' in (
          'applaudissements', 'roulement', 'presentation', 'reussite', 'echec', 'buzzer'
        )
        and jsonb_typeof(bruitage -> 'a_ms') = 'number'
      )
    ),
  add column habillage boolean not null default true;

-- Security invoker : la policy « animateur pilote ses événements » tranche.
create function public.jouer_bruitage(p_evenement uuid, p_son text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_son is null or p_son not in (
    'applaudissements', 'roulement', 'presentation', 'reussite', 'echec', 'buzzer'
  ) then
    raise exception 'bruitage inconnu' using errcode = '22023';
  end if;
  update public.pilotage
  set bruitage = jsonb_build_object(
    'son', p_son,
    'a_ms', floor(extract(epoch from clock_timestamp()) * 1000)
  )
  where evenement_id = p_evenement;
end;
$$;

revoke execute on function public.jouer_bruitage(uuid, text) from public, anon;
grant execute on function public.jouer_bruitage(uuid, text) to authenticated;

create function public.regler_habillage(p_evenement uuid, p_actif boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.pilotage set habillage = coalesce(p_actif, true) where evenement_id = p_evenement;
$$;

revoke execute on function public.regler_habillage(uuid, boolean) from public, anon;
grant execute on function public.regler_habillage(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- etat_ecran : reprise de 20261120100000_cartes_joueurs.sql, complétée
-- ---------------------------------------------------------------------------

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
      ) end,
      'logo_partenaire', e.logo_partenaire
    ),
    'son', jsonb_build_object('actif', pi.son_actif, 'volume', pi.son_volume),
    -- Plateau (2026-11-19) : le dernier bruitage demandé par la régie, et l'habillage.
    'bruitage', pi.bruitage,
    'habillage', pi.habillage,
    'membres_mode', pi.membres_mode,
    'messages_ouverts', pi.messages_ouverts,
    'messages', public.messages_ecran(e.id, p_regie),
    -- Avis des joueurs (2026-11-18) : l'écran invite à répondre, la régie compte les réponses.
    'avis', jsonb_build_object(
      'ouverts', pi.avis_ouverts,
      'recus', (select count(*) from public.avis_joueurs a where a.evenement_id = e.id)
    ),
    -- Cartes « Faisons connaissance » (2026-11-18) : le dernier tirage, et le compte des cartes
    -- prêtes pour la régie.
    'connaissance', public.connaissance_ecran(e.id, pi, p_regie),
    'cartes_pretes', case when p_regie then public.cartes_pretes(e.id) end,
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
          order by j.rejoint_le limit 1),
        -- Le téléphone du capitaine a donné signe de vie (30 s) : la régie le vérifie avant de
        -- lancer le quiz en mode jetons (2026-10-18).
        'capitaine_connecte', exists (
          select 1 from public.joueurs j
          where j.equipe_id = eq.id and j.capitaine and j.vu_le > now() - interval '30 seconds')
      ) order by eq.numero)
      from public.equipes eq where eq.evenement_id = e.id
    ), '[]'::jsonb),
    'joueurs', (select count(*) from public.joueurs j where j.evenement_id = e.id),
    -- Tous les joueurs de la soirée, par ordre d'arrivée : la page du QR code les fait défiler.
    'prenoms', coalesce((
      select jsonb_agg(j.prenom order by j.rejoint_le, j.id)
      from public.joueurs j where j.evenement_id = e.id), '[]'::jsonb),
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
        -- La photo de fond du jeu, pour l'écran commun (2026-11-15) : un chemin du bucket privé.
        'fond', m.fond,
        -- Portrait mystère (2026-11-18) : la grille de 25 noms.
        'grille', case when m.jeu = 'portrait'
          then public.grille_portrait_ecran(m, pi, e.langues, p_regie) end,
        -- Mode téléphone seulement : en mode croix, c'est la régie qui compte.
        'survivants', case
          when m.jeu = 'qcm2' and m.options ->> 'mode' = 'telephone'
            then public.survivants_quiz(m.id) end,
        -- Mode jetons : les jetons de départ et ceux qui restent, par numéro d'équipe.
        'jetons', case
          when m.jeu = 'qcm2' and m.options ->> 'mode' = 'jetons' then (
            select coalesce(jsonb_object_agg(
              j.numero::text, jsonb_build_object('depart', j.depart, 'restants', j.restants)
            ), '{}'::jsonb)
            from public.jetons_quiz(m.id) j) end,
        'passages', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', pa.id,
            'ordre', pa.ordre,
            'statut', pa.statut,
            'equipe_id', pa.equipe_id,
            'points', pa.points,
            'resultat', pa.resultat,
            'contenu_id', case
              when m.jeu = 'portrait' and not p_regie and pa.statut <> 'termine' then null
              else pa.contenu_id end,
            'public', case
              when m.jeu = 'portrait' and not p_regie and pa.statut <> 'termine' then '{}'::jsonb
              else public.contenu_public(pa.contenu_id, e.langues) end,
            'secret', public.secret_visible(m.jeu, pa, pi, e.langues, p_regie),
            'reponses', case when m.jeu = 'qcm2' then (
              select count(*) from public.reponses_quiz r where r.passage_id = pa.id) end,
            -- Mode jetons : la mise de chaque équipe, publique et en direct (2026-10-18).
            'mises', case when m.jeu = 'qcm2' and m.options ->> 'mode' = 'jetons' then (
              select coalesce(jsonb_object_agg(eq.numero::text, jsonb_build_object(
                'repartition', to_jsonb(mq.repartition),
                'valide', mq.valide,
                'debloquee', mq.debloquee
              )), '{}'::jsonb)
              from public.mises_quiz mq
              join public.equipes eq on eq.id = mq.equipe_id
              where mq.passage_id = pa.id) end,
            -- Surenchère en mode téléphones : les mots de chaque équipe (2026-11-08).
            'mots', case when m.jeu = 'enchere2' and m.options ->> 'mode' = 'telephones'
              then public.mots_ecran(pa, pi, p_regie) end,
            -- Portrait mystère : les votes du tour en cours (2026-11-18).
            'votes', case when m.jeu = 'portrait' and pa.id = pi.passage_id
              then public.votes_portrait_ecran(pa.id, pi.indices, p_regie) end,
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
