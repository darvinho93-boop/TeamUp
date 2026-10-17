-- Invités sans téléphone (2026-10-17).
--
-- Un invité sans téléphone (ou qui n'arrive pas à scanner) est ajouté à la main : par
-- l'animateur, depuis la Salle de la régie, ou par un joueur que l'animateur y a autorisé,
-- depuis son propre téléphone. Il n'a pas de session : `jeton_hash` reste vide, et aucune
-- fonction joueur (recherche par jeton) ne le trouve jamais.
--
-- Tranché le 2026-10-17 : son équipe se tire comme à l'arrivée (groupe facultatif) ; au quiz en
-- mode téléphone, il est spectateur ; il n'est jamais capitaine (le capitaine envoie les photos).

-- ---------------------------------------------------------------------------
-- Colonnes
-- ---------------------------------------------------------------------------

alter table public.joueurs alter column jeton_hash drop not null;

alter table public.joueurs
  add column sans_telephone boolean generated always as (jeton_hash is null) stored,
  add column peut_ajouter boolean not null default false,
  add constraint joueurs_capitaine_avec_telephone check (not (capitaine and jeton_hash is null)),
  add constraint joueurs_ajout_avec_telephone check (not (peut_ajouter and jeton_hash is null));

comment on column public.joueurs.peut_ajouter is
  'Autorisé par l''animateur à ajouter des invités sans téléphone depuis son propre téléphone.';

-- ---------------------------------------------------------------------------
-- Le tirage de l'équipe, commun à l'arrivée et aux ajouts
-- ---------------------------------------------------------------------------

-- Reprend le corps de `rejoindre_evenement` (20261005090000_groupes_a_melanger.sql) : verrou
-- d'arrivée, 150 au plus, équipe tirée selon le groupe. Interne : seules les fonctions
-- ci-dessous l'appellent.
create function public.placer_joueur(
  p_evenement public.evenements,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_equipe public.equipes;
begin
  if p_langue <> all (p_evenement.langues) then
    raise exception 'langue non proposée pour cet événement' using errcode = 'check_violation';
  end if;

  if p_groupe is not null and not exists (
    select 1 from public.groupes g where g.id = p_groupe and g.evenement_id = p_evenement.id
  ) then
    raise exception 'groupe inconnu' using errcode = 'check_violation';
  end if;

  -- Une arrivée à la fois par événement, jusqu'à la fin de la transaction : les effectifs lus
  -- voient toujours les arrivées précédentes.
  perform pg_advisory_xact_lock(hashtextextended(p_evenement.id::text, 0));

  if (select count(*) from public.joueurs j where j.evenement_id = p_evenement.id) >= 150 then
    raise exception 'événement complet' using errcode = 'check_violation';
  end if;

  if p_groupe is null then
    -- Comme au lot 5 : la moins remplie, le plus petit numéro en cas d'égalité.
    select eq.* into v_equipe
    from public.equipes eq
    left join public.joueurs j on j.equipe_id = eq.id
    where eq.evenement_id = p_evenement.id
    group by eq.id
    order by count(j.id), eq.numero
    limit 1;
  else
    -- Celle qui compte le moins de ce groupe, puis le moins de joueurs, au hasard ensuite.
    select eq.* into v_equipe
    from public.equipes eq
    left join public.equipes_groupes eg on eg.equipe_id = eq.id and eg.groupe_id = p_groupe
    where eq.evenement_id = p_evenement.id
    order by
      coalesce(eg.effectif, 0),
      (select count(*) from public.joueurs j where j.equipe_id = eq.id),
      random()
    limit 1;

    if v_equipe.id is not null then
      insert into public.equipes_groupes (evenement_id, equipe_id, groupe_id, effectif)
      values (p_evenement.id, v_equipe.id, p_groupe, 1)
      on conflict (equipe_id, groupe_id) do update set effectif = public.equipes_groupes.effectif + 1;
    end if;
  end if;

  insert into public.joueurs (evenement_id, equipe_id, prenom, langue, jeton_hash)
  values (p_evenement.id, v_equipe.id, btrim(p_prenom), p_langue, p_jeton_hash)
  returning * into v_joueur;

  return jsonb_build_object(
    'joueur_id', v_joueur.id,
    'evenement_id', p_evenement.id,
    'code', p_evenement.code,
    'prenom', v_joueur.prenom,
    'langue', v_joueur.langue,
    'equipe', case when v_equipe.id is null then null else jsonb_build_object(
      'id', v_equipe.id,
      'numero', v_equipe.numero,
      'nom', v_equipe.nom
    ) end
  );
end;
$$;

revoke execute on function
  public.placer_joueur(public.evenements, text, public.langue, text, uuid)
  from public, anon, authenticated;

-- L'arrivée : inchangée, sinon qu'elle passe par `placer_joueur`. Une session est obligatoire.
create or replace function public.rejoindre_evenement(
  p_code text,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evenement public.evenements;
begin
  select * into v_evenement
  from public.evenements e
  where e.code = upper(p_code)
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());

  if not found then
    raise exception 'code inconnu ou expiré' using errcode = 'no_data_found';
  end if;

  if p_jeton_hash is null then
    raise exception 'session obligatoire' using errcode = 'check_violation';
  end if;

  return public.placer_joueur(v_evenement, p_prenom, p_langue, p_jeton_hash, p_groupe);
end;
$$;

-- ---------------------------------------------------------------------------
-- Ajouter un invité
-- ---------------------------------------------------------------------------

-- Depuis le téléphone d'un joueur autorisé. Refus, dans cet ordre : session inconnue, pas
-- autorisé, soirée close. L'invité prend la langue de qui l'ajoute.
create function public.ajouter_invite(
  p_jeton_parrain text,
  p_prenom text,
  p_groupe uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parrain public.joueurs;
  v_evenement public.evenements;
begin
  select * into v_parrain from public.joueurs j where j.jeton_hash = p_jeton_parrain;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;

  if not v_parrain.peut_ajouter then
    raise exception 'ajout non autorisé' using errcode = 'insufficient_privilege';
  end if;

  select * into v_evenement
  from public.evenements e
  where e.id = v_parrain.evenement_id
    and e.statut in ('preparation', 'repetition', 'en_cours');
  if not found then
    raise exception 'événement clos' using errcode = 'check_violation';
  end if;

  return public.placer_joueur(v_evenement, p_prenom, v_parrain.langue, null, p_groupe);
end;
$$;

-- Depuis la régie, sous la session de l'animateur. Une fonction plutôt qu'un `insert` : le
-- compteur des groupes ne s'écrit que par l'arrivée. L'invité prend la première langue.
create function public.ajouter_invite_regie(
  p_evenement uuid,
  p_prenom text,
  p_groupe uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evenement public.evenements;
begin
  if not public.anime(p_evenement) then
    raise exception 'événement inconnu' using errcode = 'insufficient_privilege';
  end if;

  select * into v_evenement
  from public.evenements e
  where e.id = p_evenement
    and e.statut in ('preparation', 'repetition', 'en_cours');
  if not found then
    raise exception 'événement clos' using errcode = 'check_violation';
  end if;

  return public.placer_joueur(v_evenement, p_prenom, v_evenement.langues[1], null, p_groupe);
end;
$$;

revoke execute on function
  public.ajouter_invite(text, text, uuid),
  public.ajouter_invite_regie(uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.ajouter_invite(text, text, uuid) to service_role;
grant execute on function public.ajouter_invite_regie(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Quiz : sans téléphone, spectateur
-- ---------------------------------------------------------------------------

-- Reprise de 20260925090000_quiz_et_mime.sql, une condition en plus. Le mode croix ne lit pas
-- cette fonction : l'invité y joue debout comme les autres.
create or replace function public.quiz_joueurs(p_manche uuid)
returns table (joueur_id uuid, equipe_id uuid, elimine boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with manche as (
    select m.id, m.evenement_id from public.manches m where m.id = p_manche
  ),
  debut as (
    select min(pa.commence_le) as le from public.passages pa where pa.manche_id = p_manche
  ),
  comptees as (
    select pa.id, (
      -- Les propositions sont dans le même ordre dans toutes les langues : une seule suffit.
      select (s.valeur ->> 'bonne')::smallint
      from public.contenus_secrets s
      where s.contenu_id = pa.contenu_id
      order by (s.langue = 'fr') desc
      limit 1
    ) as bonne
    from public.passages pa
    where pa.manche_id = p_manche
      and pa.statut = 'termine'
      and not coalesce((pa.resultat ->> 'annulee')::boolean, false)
  )
  select j.id, j.equipe_id, exists (
    select 1 from comptees q
    where not exists (
      select 1 from public.reponses_quiz r
      where r.passage_id = q.id and r.joueur_id = j.id and r.choix = q.bonne
    )
  )
  from public.joueurs j
  join manche on manche.evenement_id = j.evenement_id
  cross join debut
  where j.equipe_id is not null
    and j.jeton_hash is not null
    and (debut.le is null or j.rejoint_le <= debut.le);
$$;

-- ---------------------------------------------------------------------------
-- Le téléphone sait s'il peut ajouter
-- ---------------------------------------------------------------------------

-- Reprise de 20260926090000_photo_challenge.sql, la clé `peut_ajouter` en plus.
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
      'peut_ajouter', j.peut_ajouter
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
      'points', coalesce(c.points, 0)
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
    'quiz', public.quiz_du_joueur(j),
    'photos', public.photos_du_joueur(j)
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  left join public.classement c on c.equipe_id = eq.id
  where j.jeton_hash = p_jeton_hash;
$$;
