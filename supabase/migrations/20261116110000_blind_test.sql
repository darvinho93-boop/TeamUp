-- Blind test (2026-11-15) : la musique joue sur l'écran commun, le premier capitaine qui buzze
-- arrête l'extrait, son équipe a 7 s pour répondre à voix haute, la régie juge. Une mauvaise
-- réponse bloque l'équipe sur ce titre.
--
-- Les titres d'une manche vivent dans `manches.options.titres` ([{ musique, debut_s }], un par
-- passage, dans l'ordre) et la durée d'écoute dans `options.extrait_s` : `etat_ecran` les
-- transmet déjà. Le résultat d'un passage garde `ecoute_ms` (l'écoute faite), `bloquees` (les
-- numéros d'équipe qui ont mal répondu), `buzz` (l'équipe qui a la main) et `trouve_par`.

insert into public.jeux (code, nom, sequentiel, chrono_passage_s, beta, ordre_affichage)
values ('blind', 'Blind test', false, 60, false, 8)
on conflict (code) do nothing;

-- La réponse d'un titre : « titre — artiste ». L'artiste est facultatif.
alter table public.musiques
  add column artiste text check (artiste is null or char_length(btrim(artiste)) between 1 and 80);

-- ---------------------------------------------------------------------------
-- Le buzzer du capitaine
-- ---------------------------------------------------------------------------

-- Rôle de service seulement : la route `/api/partie/[code]/buzz` l'appelle avec le hash de la
-- session. Sous le verrou du pilotage de la soirée : de deux capitaines qui buzzent ensemble,
-- le premier arrivé à la base l'emporte, l'autre reçoit « trop tard ».
create function public.buzzer_blind(p_jeton_hash text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_pilotage public.pilotage;
  v_manche public.manches;
  v_passage public.passages;
  v_numero smallint;
  v_extrait_ms numeric;
  v_ecoute_ms numeric;
  v_ecoule_ms numeric;
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;
  if not v_joueur.capitaine or v_joueur.equipe_id is null then
    raise exception 'pas capitaine' using errcode = 'insufficient_privilege';
  end if;

  select * into v_pilotage from public.pilotage pi
  where pi.evenement_id = v_joueur.evenement_id
  for update;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  select * into v_passage from public.passages pa
  where pa.id = v_pilotage.passage_id and pa.manche_id = v_manche.id;
  if v_manche.jeu is distinct from 'blind'
    or v_pilotage.scene <> 'jeu'
    or v_passage.id is null
    or v_pilotage.etape is distinct from 'ecoute'
    or v_pilotage.chrono_depart is null
  then
    -- Un autre capitaine a buzzé avant, ou la régie a arrêté la musique.
    raise exception 'trop tard' using errcode = 'PT409';
  end if;

  v_ecoule_ms := extract(epoch from (now() - v_pilotage.chrono_depart)) * 1000;
  if v_ecoule_ms >= coalesce(v_pilotage.chrono_duree_s, 0) * 1000 then
    raise exception 'extrait fini' using errcode = 'PT409';
  end if;

  select eq.numero into v_numero from public.equipes eq where eq.id = v_joueur.equipe_id;
  if coalesce(v_passage.resultat -> 'bloquees', '[]'::jsonb) @> to_jsonb(v_numero) then
    raise exception 'équipe bloquée' using errcode = 'PT403';
  end if;

  v_extrait_ms := coalesce((v_manche.options ->> 'extrait_s')::numeric, 30) * 1000;
  v_ecoute_ms := coalesce((v_passage.resultat ->> 'ecoute_ms')::numeric, 0);
  v_ecoute_ms := v_ecoute_ms + least(greatest(v_ecoule_ms, 0), greatest(v_extrait_ms - v_ecoute_ms, 0));

  update public.passages pa
  set resultat = pa.resultat
    || jsonb_build_object('ecoute_ms', round(v_ecoute_ms)::integer, 'buzz', v_numero)
  where pa.id = v_passage.id;

  update public.pilotage pi set
    etape = 'buzz',
    chrono_depart = now(),
    chrono_duree_s = 7,
    maj_le = clock_timestamp()
  where pi.evenement_id = v_joueur.evenement_id;

  return jsonb_build_object('equipe', v_numero, 'evenement', v_joueur.evenement_id);
end;
$$;

revoke execute on function public.buzzer_blind(text) from public, anon, authenticated;
grant execute on function public.buzzer_blind(text) to service_role;

-- ---------------------------------------------------------------------------
-- Ce que voit un téléphone
-- ---------------------------------------------------------------------------

-- L'étape, le titre en cours, qui a la main, si mon équipe peut encore buzzer. Jamais la musique
-- ni la réponse : elles ne quittent pas l'écran commun et la régie.
create function public.blind_du_joueur(p_joueur public.joueurs) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pilotage public.pilotage;
  v_manche public.manches;
  v_passage public.passages;
  v_numero smallint;
  v_bloquee boolean;
  v_ouvert boolean;
begin
  select * into v_pilotage from public.pilotage pi where pi.evenement_id = p_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  if v_manche.jeu is distinct from 'blind' or v_pilotage.scene <> 'jeu' then
    return null;
  end if;
  select * into v_passage from public.passages pa
  where pa.id = v_pilotage.passage_id and pa.manche_id = v_manche.id;
  select eq.numero into v_numero from public.equipes eq where eq.id = p_joueur.equipe_id;

  v_bloquee := v_numero is not null
    and coalesce(v_passage.resultat -> 'bloquees', '[]'::jsonb) @> to_jsonb(v_numero);
  v_ouvert := v_pilotage.etape = 'ecoute'
    and v_pilotage.chrono_depart is not null
    and now() < v_pilotage.chrono_depart + make_interval(secs => coalesce(v_pilotage.chrono_duree_s, 0));

  return jsonb_build_object(
    'etape', v_pilotage.etape,
    'titre', v_passage.ordre,
    'titres', (select count(*) from public.passages pa where pa.manche_id = v_manche.id),
    'equipe', v_numero,
    'buzz', (v_passage.resultat ->> 'buzz')::integer,
    'trouve_par', (v_passage.resultat ->> 'trouve_par')::integer,
    'bloquee', v_bloquee,
    'peut_buzzer', p_joueur.capitaine and v_numero is not null and v_ouvert and not v_bloquee
  );
end;
$$;

revoke execute on function public.blind_du_joueur(public.joueurs) from public, anon, authenticated;
grant execute on function public.blind_du_joueur(public.joueurs) to service_role;

-- Reprise de 20261115090000_messages_salle.sql : `blind` en plus.
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
      'messages_ouverts', (select pi.messages_ouverts from public.pilotage pi where pi.evenement_id = e.id)
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
    'photos', public.photos_du_joueur(j)
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  where j.jeton_hash = p_jeton_hash;
$$;
