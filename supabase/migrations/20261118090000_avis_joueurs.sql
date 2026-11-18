-- Avis des joueurs en fin de soirée (2026-11-18).
--
-- Un retour en deux temps, en texte libre : d'abord une à trois choses aimées, puis ce qui a
-- moins plu, ou « rien à redire ». La régie ouvre et ferme le questionnaire d'une touche ; il
-- reste ouvert après la clôture de la soirée tant qu'elle ne l'a pas fermé. Un avis par
-- téléphone : le dernier envoi remplace le précédent.
--
-- Anonyme pour l'animateur : le prénom n'est recopié que si le joueur accepte d'être cité (les
-- témoignages de la vitrine). Écart assumé à la spec v3 : un usage du téléphone hors jeu, comme
-- les messages sur le grand écran.
--
-- Aucune écriture directe : `donner_avis` (le joueur, par le serveur, rôle de service),
-- `regler_avis` (la régie).

alter table public.pilotage
  add column avis_ouverts boolean not null default false;

comment on column public.pilotage.avis_ouverts is
  'Les joueurs peuvent donner leur avis sur la soirée (touche de la régie).';

-- Un texte d'avis nettoyé : caractères de contrôle et blancs réduits à une espace ; avec
-- `p_lignes`, les sauts de ligne restent (deux d'affilée au plus). Vide : ''. Plus long que
-- `p_max` une fois nettoyé : null (refusé, jamais tronqué en silence).
create function public.nettoyer_avis(p_texte text, p_max integer, p_lignes boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(t) <= p_max then t end
  from (
    select case
      when p_lignes then btrim(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                replace(replace(coalesce(p_texte, ''), E'\r\n', E'\n'), E'\r', E'\n'),
                '[\u0001-\u0009\u000b-\u001f\u007f-\u009f]', ' ', 'g'),
              ' {2,}', ' ', 'g'),
            ' *\n *', E'\n', 'g'),
          E'\n{3,}', E'\n\n', 'g'),
        E' \n')
      else btrim(regexp_replace(coalesce(p_texte, ''), '[[:cntrl:][:space:]]+', ' ', 'g'))
    end as t
  ) n;
$$;

-- Les choses aimées : une à trois, chacune de 1 à 200 caractères.
create function public.avis_positifs_valides(p_positifs text[]) returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_positifs) between 1 and 3
    and not exists (
      select 1 from unnest(p_positifs) t where t is null or char_length(t) not between 1 and 200
    );
$$;

create table public.avis_joueurs (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  -- Un avis par joueur. Null : le joueur a été retiré depuis, son avis reste.
  joueur_id uuid unique references public.joueurs (id) on delete set null,
  positifs text[] not null check (public.avis_positifs_valides(positifs)),
  negatif text check (char_length(negatif) between 1 and 500),
  rien_a_redire boolean not null default false,
  -- Le joueur accepte que Team Up! cite ses mots avec son prénom, recopié à l'envoi.
  citable boolean not null default false,
  prenom text,
  langue public.langue not null,
  cree_le timestamptz not null default clock_timestamp(),
  modifie_le timestamptz not null default clock_timestamp(),
  -- Ce qui a moins plu, ou « rien à redire » : l'un des deux, jamais les deux.
  check ((negatif is null) = rien_a_redire),
  check (citable = (prenom is not null))
);

create index avis_joueurs_evenement_idx on public.avis_joueurs (evenement_id, modifie_le desc);

alter table public.avis_joueurs enable row level security;

create policy "animateur lit les avis de ses événements" on public.avis_joueurs
  for select to authenticated
  using (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Envoi et réglage
-- ---------------------------------------------------------------------------

-- Le joueur de cette session donne (ou remplace) son avis. Refus : session inconnue (un invité
-- sans téléphone n'en a pas), avis fermés, textes invalides. Partie terminée : accepté, c'est
-- souvent après la clôture qu'on répond.
create function public.donner_avis(
  p_jeton_hash text,
  p_positifs text[],
  p_negatif text,
  p_rien_a_redire boolean,
  p_citable boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_ouverts boolean;
  v_rien boolean := coalesce(p_rien_a_redire, false);
  v_citable boolean := coalesce(p_citable, false);
  v_nettoyes text[];
  v_positifs text[];
  v_negatif text;
begin
  -- Le verrou du joueur : deux envois simultanés se suivent au lieu de se croiser.
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash for update;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;

  select pi.avis_ouverts into v_ouverts
  from public.pilotage pi where pi.evenement_id = v_joueur.evenement_id;
  if not coalesce(v_ouverts, false) then
    raise exception 'avis fermés' using errcode = 'PT403';
  end if;

  select coalesce(array_agg(public.nettoyer_avis(u.brut, 200, false) order by u.i), '{}')
  into v_nettoyes
  from unnest(coalesce(p_positifs, '{}')) with ordinality as u(brut, i);
  select coalesce(array_agg(t order by i), '{}') into v_positifs
  from unnest(v_nettoyes) with ordinality as u(t, i)
  where t <> '';
  v_negatif := case when v_rien then null else public.nettoyer_avis(p_negatif, 500, true) end;

  if cardinality(coalesce(p_positifs, '{}')) > 3
    or array_position(v_nettoyes, null) is not null
    or not public.avis_positifs_valides(v_positifs)
    or (not v_rien and coalesce(v_negatif, '') = '') then
    raise exception 'avis invalide' using errcode = 'check_violation';
  end if;

  insert into public.avis_joueurs as a
    (evenement_id, joueur_id, positifs, negatif, rien_a_redire, citable, prenom, langue)
  values (
    v_joueur.evenement_id, v_joueur.id, v_positifs, v_negatif, v_rien, v_citable,
    case when v_citable then v_joueur.prenom end, v_joueur.langue
  )
  on conflict (joueur_id) do update set
    positifs = excluded.positifs,
    negatif = excluded.negatif,
    rien_a_redire = excluded.rien_a_redire,
    citable = excluded.citable,
    prenom = excluded.prenom,
    langue = excluded.langue,
    modifie_le = clock_timestamp();

  return jsonb_build_object('evenement_id', v_joueur.evenement_id);
end;
$$;

revoke execute on function public.donner_avis(text, text[], text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.donner_avis(text, text[], text, boolean, boolean) to service_role;

-- Comme `regler_messages` : ne touche pas à `maj_le` (pas de « pilotage périmé » à la touche
-- suivante). Security invoker : la policy « animateur pilote ses événements » tranche.
create function public.regler_avis(p_evenement uuid, p_ouverts boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.pilotage
  set avis_ouverts = p_ouverts
  where evenement_id = p_evenement;
$$;

revoke execute on function public.regler_avis(uuid, boolean) from public, anon;
grant execute on function public.regler_avis(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Lecture : le téléphone voit son seul avis (index unique), l'écran et la régie le compte
-- ---------------------------------------------------------------------------

create or replace function public.etat_joueur(p_jeton_hash text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'joueur', jsonb_build_object(
      'id', j.id,
      'prenom', j.prenom,
      'langue', j.langue,
      'capitaine', j.capitaine,
      'peut_ajouter', j.peut_ajouter,
      'volontaire', j.volontaire,
      'nom_propose', j.nom_propose
    ),
    'evenement', jsonb_build_object(
      'id', e.id,
      'code', e.code,
      'statut', e.statut,
      'langues', e.langues,
      'photos_closes', e.photos_closes_le is not null,
      'messages_ouverts', pi.messages_ouverts,
      'avis_ouverts', pi.avis_ouverts
    ),
    'equipe', case when eq.id is null then null else jsonb_build_object(
      'id', eq.id,
      'numero', eq.numero,
      'nom', eq.nom,
      'nom_fige', eq.nom_fige,
      'points', (
        select coalesce(sum(s.points), 0)::integer from public.scores s where s.equipe_id = eq.id
      )
    ) end,
    'manche', (
      select jsonb_build_object('jeu', m.jeu, 'ordre', m.ordre, 'options', m.options)
      from public.manches m
      where m.evenement_id = e.id and m.statut = 'en_cours'
      order by m.ordre
      limit 1
    ),
    'prochaine', (
      select jsonb_build_object('jeu', m.jeu, 'ordre', m.ordre)
      from public.manches m
      where m.evenement_id = e.id and m.statut = 'a_venir'
      order by m.ordre
      limit 1
    ),
    'programme', coalesce((
      select jsonb_agg(m.jeu order by m.ordre)
      from public.manches m
      where m.evenement_id = e.id and m.statut <> 'annulee'
    ), '[]'::jsonb),
    'quiz', public.quiz_du_joueur(j),
    'surenchere', public.surenchere_du_joueur(j),
    'blind', public.blind_du_joueur(j),
    'photos', public.photos_du_joueur(j),
    'avis', (
      select jsonb_build_object(
        'positifs', to_jsonb(a.positifs),
        'negatif', a.negatif,
        'rien_a_redire', a.rien_a_redire,
        'citable', a.citable
      )
      from public.avis_joueurs a
      where a.joueur_id = j.id
    )
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.pilotage pi on pi.evenement_id = e.id
  left join public.equipes eq on eq.id = j.equipe_id
  where j.jeton_hash = p_jeton_hash;
$$;

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
    'membres_mode', pi.membres_mode,
    'messages_ouverts', pi.messages_ouverts,
    'messages', public.messages_ecran(e.id, p_regie),
    -- Avis des joueurs (2026-11-18) : l'écran invite à répondre, la régie compte les réponses.
    'avis', jsonb_build_object(
      'ouverts', pi.avis_ouverts,
      'recus', (select count(*) from public.avis_joueurs a where a.evenement_id = e.id)
    ),
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
            'contenu_id', pa.contenu_id,
            'public', public.contenu_public(pa.contenu_id, e.langues),
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
