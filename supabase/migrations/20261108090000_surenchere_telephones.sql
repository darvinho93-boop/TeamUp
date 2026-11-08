-- Surenchère en mode téléphones (2026-11-08).
--
-- Un second mode de la Surenchère, choisi au lancement de la manche (`manches.options.mode` :
-- `voix`, le jeu de la spec v3, ou `telephones`). Pendant le chrono, le capitaine de chaque équipe
-- tape le plus de mots possible sur le sujet, toutes les équipes en même temps. L'écran ne montre
-- que le nombre de mots de chaque équipe tant que le chrono court, puis tous les mots d'un coup.
-- L'animateur raye les mots hors sujet ; le podium du thème rapporte +100, +60 et +30
-- (`packages/game`, `podiumDesMots`).
--
-- Écart assumé à la spec v3, comme le quiz en mode jetons : le téléphone du capitaine sert à jouer.
--
-- Un mot rayé pendant le chrono est **masqué** : l'écran ne le montrera jamais (un mot déplacé en
-- plein mariage). Rayé après la fin du chrono, il s'affiche barré.

-- ---------------------------------------------------------------------------
-- Les mots
-- ---------------------------------------------------------------------------

create table public.mots_surenchere (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null,
  -- Dénormalisé, comme pour les mises : la policy travaille par événement.
  evenement_id uuid not null,
  equipe_id uuid not null references public.equipes (id) on delete cascade,
  mot text not null check (char_length(mot) between 1 and 40),
  -- Sans casse, sans accents latins, espaces réduits (`cle_prenom`) : un doublon dans l'équipe.
  cle text not null,
  refuse boolean not null default false,
  -- Rayé pendant le chrono : jamais montré à l'écran.
  masque boolean not null default false,
  ajoute_le timestamptz not null default clock_timestamp(),
  unique (passage_id, equipe_id, cle),
  foreign key (passage_id, evenement_id)
    references public.passages (id, evenement_id) on delete cascade
);

create index mots_surenchere_evenement_idx on public.mots_surenchere (evenement_id);
create index mots_surenchere_equipe_idx on public.mots_surenchere (equipe_id);

alter table public.mots_surenchere enable row level security;

-- Lecture pour la régie et l'écran ; aucune écriture directe : `ajouter_mot` et `retirer_mot`
-- (le capitaine, par le serveur), `refuser_mot` (la régie).
create policy "animateur lit les mots de ses événements" on public.mots_surenchere
  for select to authenticated
  using (public.anime(evenement_id));

-- Le chrono du thème en cours court encore (une seconde de grâce, comme pour le quiz) : la saisie
-- est ouverte, et un mot rayé maintenant ne paraîtra jamais à l'écran.
create function public.chrono_mots_ouvert(p_pilotage public.pilotage) returns boolean
language sql
stable
set search_path = ''
as $$
  select p_pilotage.etape = 'chrono'
    and p_pilotage.chrono_depart is not null
    and clock_timestamp() <= p_pilotage.chrono_depart
      + make_interval(secs => p_pilotage.chrono_duree_s + 1);
$$;

-- ---------------------------------------------------------------------------
-- Le capitaine tape ses mots
-- ---------------------------------------------------------------------------

-- Le capitaine de ce jeton, son équipe et le thème en cours, si la saisie est ouverte. Refus, dans
-- cet ordre : session inconnue, chrono fermé (pas le mode téléphones, pas de thème en cours, temps
-- écoulé à l'heure de la base), pas capitaine.
create function public.capitaine_aux_mots(p_jeton_hash text)
returns table (equipe_id uuid, evenement_id uuid, passage_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_pilotage public.pilotage;
  v_manche public.manches;
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;

  select * into v_pilotage from public.pilotage pi where pi.evenement_id = v_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  if v_manche.jeu is distinct from 'enchere2'
    or v_manche.options ->> 'mode' is distinct from 'telephones'
    or v_pilotage.scene <> 'jeu'
    or v_pilotage.passage_id is null
    or not public.chrono_mots_ouvert(v_pilotage)
  then
    raise exception 'chrono fermé' using errcode = 'check_violation';
  end if;

  if not v_joueur.capitaine or v_joueur.equipe_id is null then
    raise exception 'pas capitaine' using errcode = 'insufficient_privilege';
  end if;

  equipe_id := v_joueur.equipe_id;
  evenement_id := v_joueur.evenement_id;
  passage_id := v_pilotage.passage_id;
  return next;
end;
$$;

revoke execute on function public.capitaine_aux_mots(text) from public, anon, authenticated;
grant execute on function public.capitaine_aux_mots(text) to service_role;

-- Les mots d'une équipe sur un thème, dans l'ordre où ils sont arrivés.
create function public.mots_de_l_equipe(p_passage uuid, p_equipe uuid) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ms.id, 'mot', ms.mot, 'refuse', ms.refuse
  ) order by ms.ajoute_le, ms.id), '[]'::jsonb)
  from public.mots_surenchere ms
  where ms.passage_id = p_passage and ms.equipe_id = p_equipe;
$$;

revoke execute on function public.mots_de_l_equipe(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mots_de_l_equipe(uuid, uuid) to service_role;

-- Un mot de plus pour l'équipe du capitaine. Refus, après ceux de `capitaine_aux_mots` : mot vide
-- ou de plus de 40 caractères, déjà dans la liste de l'équipe (sans casse ni accents), 60 mots
-- déjà. Renvoie la liste de l'équipe.
create function public.ajouter_mot(p_jeton_hash text, p_mot text) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cap record;
  v_mot text := regexp_replace(btrim(coalesce(p_mot, '')), '\s+', ' ', 'g');
  v_n integer;
begin
  select * into v_cap from public.capitaine_aux_mots(p_jeton_hash);

  if char_length(v_mot) not between 1 and 40 then
    raise exception 'mot invalide' using errcode = 'check_violation';
  end if;

  -- Deux envois simultanés du même capitaine ne passent pas tous deux la limite.
  perform pg_advisory_xact_lock(hashtext('mots:' || v_cap.passage_id || ':' || v_cap.equipe_id));
  select count(*) into v_n from public.mots_surenchere ms
  where ms.passage_id = v_cap.passage_id and ms.equipe_id = v_cap.equipe_id;
  if v_n >= 60 then
    raise exception 'trop de mots' using errcode = 'check_violation';
  end if;

  insert into public.mots_surenchere (passage_id, evenement_id, equipe_id, mot, cle)
  values (v_cap.passage_id, v_cap.evenement_id, v_cap.equipe_id, v_mot, public.cle_prenom(v_mot))
  on conflict (passage_id, equipe_id, cle) do nothing;
  if not found then
    raise exception 'déjà dans la liste' using errcode = 'unique_violation';
  end if;

  return public.mots_de_l_equipe(v_cap.passage_id, v_cap.equipe_id);
end;
$$;

revoke execute on function public.ajouter_mot(text, text) from public, anon, authenticated;
grant execute on function public.ajouter_mot(text, text) to service_role;

-- Le capitaine retire un de ses mots (une faute de frappe), tant que le chrono court. Un mot qui
-- n'est pas de son équipe ou de ce thème ne bouge pas. Renvoie la liste de l'équipe.
create function public.retirer_mot(p_jeton_hash text, p_mot uuid) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cap record;
begin
  select * into v_cap from public.capitaine_aux_mots(p_jeton_hash);
  delete from public.mots_surenchere ms
  where ms.id = p_mot and ms.passage_id = v_cap.passage_id and ms.equipe_id = v_cap.equipe_id;
  return public.mots_de_l_equipe(v_cap.passage_id, v_cap.equipe_id);
end;
$$;

revoke execute on function public.retirer_mot(text, uuid) from public, anon, authenticated;
grant execute on function public.retirer_mot(text, uuid) to service_role;

-- La régie raye (ou rétablit) un mot, sous la session de l'animateur de la soirée. Rayé pendant le
-- chrono, il est masqué pour de bon ; rétabli, il redevient visible. Refusé une fois le thème
-- classé : ses points sont déjà donnés.
create function public.refuser_mot(p_mot uuid, p_refuse boolean) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_mot public.mots_surenchere;
  v_pilotage public.pilotage;
begin
  select * into v_mot from public.mots_surenchere ms where ms.id = p_mot;
  if not found or not public.anime(v_mot.evenement_id) then
    raise exception 'mot inconnu' using errcode = 'insufficient_privilege';
  end if;
  if exists (
    select 1 from public.passages pa where pa.id = v_mot.passage_id and pa.statut = 'termine'
  ) then
    raise exception 'thème déjà classé' using errcode = 'check_violation';
  end if;

  select * into v_pilotage from public.pilotage pi where pi.evenement_id = v_mot.evenement_id;
  update public.mots_surenchere ms
  set refuse = p_refuse,
    masque = p_refuse and (ms.masque or (
      v_pilotage.passage_id is not distinct from ms.passage_id
      and public.chrono_mots_ouvert(v_pilotage)))
  where ms.id = p_mot;
end;
$$;

revoke execute on function public.refuser_mot(uuid, boolean) from public, anon;
grant execute on function public.refuser_mot(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Ce que voit un téléphone
-- ---------------------------------------------------------------------------

-- Le thème et, une fois dévoilé, le sujet, dans la langue du joueur ; le chrono ; les mots de son
-- équipe seulement (capitaine ou coéquipier) ; au podium, le rang et les points de son équipe.
-- Le sujet n'arrive qu'aux étapes où l'écran commun le montre déjà à toute la salle. Rien sur les
-- autres équipes : une relecture de téléphone ne parcourt pas toute la soirée (2026-10-31).
create function public.surenchere_du_joueur(p_joueur public.joueurs) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pilotage public.pilotage;
  v_manche public.manches;
  v_passage public.passages;
  v_theme jsonb;
  v_sujet jsonb;
  v_numero smallint;
begin
  select * into v_pilotage from public.pilotage pi where pi.evenement_id = p_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  if v_manche.jeu is distinct from 'enchere2'
    or v_manche.options ->> 'mode' is distinct from 'telephones'
    or v_pilotage.scene <> 'jeu'
  then
    return null;
  end if;

  select * into v_passage from public.passages pa
  where pa.id = v_pilotage.passage_id and pa.manche_id = v_manche.id;
  if found then
    select t.valeur into v_theme from public.contenus_traductions t
    where t.contenu_id = v_passage.contenu_id
    order by (t.langue = p_joueur.langue) desc, (t.langue = 'fr') desc
    limit 1;
    if v_pilotage.etape in ('sujet', 'chrono', 'podium') then
      select s.valeur into v_sujet from public.contenus_secrets s
      where s.contenu_id = v_passage.contenu_id
      order by (s.langue = p_joueur.langue) desc, (s.langue = 'fr') desc
      limit 1;
    end if;
  end if;
  select eq.numero into v_numero from public.equipes eq where eq.id = p_joueur.equipe_id;

  return jsonb_build_object(
    'mode', 'telephones',
    'serveur_ms', floor(extract(epoch from clock_timestamp()) * 1000),
    'etape', v_pilotage.etape,
    'passage_id', v_passage.id,
    'chrono_depart_ms', floor(extract(epoch from v_pilotage.chrono_depart) * 1000),
    'chrono_duree_s', v_pilotage.chrono_duree_s,
    'theme', v_theme -> 'theme',
    'sujet', v_sujet -> 'sujet',
    'capitaine', p_joueur.capitaine and p_joueur.equipe_id is not null,
    'equipe', p_joueur.equipe_id is not null,
    'mots', case when v_passage.id is not null and p_joueur.equipe_id is not null
      then public.mots_de_l_equipe(v_passage.id, p_joueur.equipe_id)
      else '[]'::jsonb end,
    'rang', case when v_pilotage.etape = 'podium'
      then (v_passage.resultat -> 'rangs' ->> v_numero::text)::integer end,
    'points', case when v_pilotage.etape = 'podium'
      then coalesce((v_passage.resultat -> 'points' ->> v_numero::text)::integer, 0) end
  );
end;
$$;

revoke execute on function public.surenchere_du_joueur(public.joueurs)
  from public, anon, authenticated;
grant execute on function public.surenchere_du_joueur(public.joueurs) to service_role;

-- Reprise de 20261101090000_inscription_et_formation.sql : `surenchere` en plus.
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
      'photos_closes', e.photos_closes_le is not null
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
    'photos', public.photos_du_joueur(j)
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  where j.jeton_hash = p_jeton_hash;
$$;

-- ---------------------------------------------------------------------------
-- L'écran et la régie
-- ---------------------------------------------------------------------------

-- Les mots d'un thème, par numéro d'équipe : `valides` (les mots non rayés) toujours, et `liste`
-- seulement une fois le chrono écoulé (ou le thème classé) pour l'écran, toujours pour la régie.
-- Les mots masqués (rayés pendant le chrono) ne sortent que vers la régie.
create function public.mots_ecran(
  p_passage public.passages,
  p_pilotage public.pilotage,
  p_regie boolean
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(eq.numero::text, jsonb_build_object(
    'valides', (
      select count(*) from public.mots_surenchere ms
      where ms.passage_id = p_passage.id and ms.equipe_id = eq.id and not ms.refuse),
    'liste', case when p_regie
      or p_passage.statut = 'termine'
      or (p_passage.id is not distinct from p_pilotage.passage_id and (
        p_pilotage.etape = 'podium'
        or (p_pilotage.etape = 'chrono' and p_pilotage.chrono_depart is not null
          and not public.chrono_mots_ouvert(p_pilotage))))
    then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ms.id, 'mot', ms.mot, 'refuse', ms.refuse, 'masque', ms.masque
      ) order by ms.ajoute_le, ms.id), '[]'::jsonb)
      from public.mots_surenchere ms
      where ms.passage_id = p_passage.id and ms.equipe_id = eq.id and (p_regie or not ms.masque)
    ) end
  )), '{}'::jsonb)
  from public.equipes eq
  where eq.evenement_id = p_passage.evenement_id;
$$;

revoke execute on function public.mots_ecran(public.passages, public.pilotage, boolean)
  from public, anon;
grant execute on function public.mots_ecran(public.passages, public.pilotage, boolean)
  to authenticated, service_role;

-- Reprise de 20261018120000_mime_et_quiz.sql : à la Surenchère, le sujet reste à l'écran au
-- podium du mode téléphones.
create or replace function public.secret_visible(
  p_jeu public.jeu,
  p_passage public.passages,
  p_pilotage public.pilotage,
  p_langues public.langue[],
  p_regie boolean
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_secret jsonb := public.contenu_secret(p_passage.contenu_id, p_langues);
  v_courant boolean := p_passage.id is not distinct from p_pilotage.passage_id;
  v_resultat jsonb := '{}'::jsonb;
  v_langue text;
begin
  if p_regie then
    return v_secret;
  end if;

  if p_jeu = 'list2' and v_courant then
    if p_pilotage.etape = 'consigne' then
      for v_langue in select jsonb_object_keys(v_secret) loop
        v_resultat := v_resultat || jsonb_build_object(
          v_langue, jsonb_build_object('reponse', v_secret -> v_langue -> 'reponse'));
      end loop;
      return v_resultat;
    elsif p_pilotage.etape in ('lance', 'trouve', 'echec') and p_pilotage.indices > 0 then
      for v_langue in select jsonb_object_keys(v_secret) loop
        v_resultat := v_resultat || jsonb_build_object(
          v_langue, jsonb_build_object('indices', (
            select coalesce(jsonb_agg(i.valeur order by i.rang), '[]'::jsonb)
            from jsonb_array_elements(v_secret -> v_langue -> 'indices')
              with ordinality as i (valeur, rang)
            where i.rang <= p_pilotage.indices)));
      end loop;
      return v_resultat;
    end if;
  elsif p_jeu = 'enchere2' then
    if p_passage.statut = 'termine'
      or (v_courant and p_pilotage.etape in ('sujet', 'chrono', 'tenu', 'rate', 'podium')) then
      return v_secret;
    end if;
  elsif p_jeu = 'qcm2' then
    if p_passage.statut = 'termine'
      and not coalesce((p_passage.resultat ->> 'annulee')::boolean, false) then
      return v_secret;
    end if;
  elsif p_jeu = 'mime2' then
    -- Le mot paraît à l'écran le temps que le premier de la file le lise (étape « secret »),
    -- disparaît au lancement de la chaîne, revient au verdict (2026-10-18).
    if p_passage.statut = 'termine' or (v_courant and p_pilotage.etape = 'secret') then
      return v_secret;
    end if;
  end if;

  return null;
end;
$$;

-- Reprise de 20261104090000_prenoms_a_l_ecran.sql, avec `passage.mots` (Surenchère en mode
-- téléphones).
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
