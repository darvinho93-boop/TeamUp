-- Capitaines volontaires et noms d'équipe (2026-10-17).
--
-- À l'arrivée, l'invité peut se proposer comme capitaine (`joueurs.volontaire`). Quand tout le
-- monde est là, la régie tire les capitaines (`tirer_capitaines`) : dans chaque équipe qui n'en
-- a pas, un volontaire au hasard, sinon n'importe quel joueur qui a un téléphone. Le capitaine
-- peut renommer son équipe depuis son téléphone (`renommer_equipe`), sauf si la régie a figé le
-- nom (`equipes.nom_fige`).
--
-- Tranché le 2026-10-17. Écart assumé à la spec v3 (le téléphone y sert à trois choses ;
-- renommer l'équipe en est une quatrième, hors jeu, un téléphone par équipe).

alter table public.joueurs
  add column volontaire boolean not null default false;

alter table public.equipes
  add column nom_fige boolean not null default false;

comment on column public.joueurs.volontaire is
  'S''est proposé comme capitaine à l''arrivée : prioritaire au tirage des capitaines.';
comment on column public.equipes.nom_fige is
  'La régie a bloqué le nom : le capitaine ne peut plus le changer.';

-- ---------------------------------------------------------------------------
-- L'arrivée garde le volontariat
-- ---------------------------------------------------------------------------

-- Signatures changées : on supprime puis on recrée. `ajouter_invite` et `ajouter_invite_regie`
-- appellent toujours `placer_joueur` avec cinq arguments (pas de volontaire).
drop function public.rejoindre_evenement(text, text, public.langue, text, uuid);
drop function public.placer_joueur(public.evenements, text, public.langue, text, uuid);

-- Reprise de 20261017090000_invites_sans_telephone.sql, le volontariat en plus.
create function public.placer_joueur(
  p_evenement public.evenements,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid,
  p_volontaire boolean default false
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

  -- Un invité sans téléphone n'est jamais volontaire : il ne pourrait pas être capitaine.
  insert into public.joueurs (evenement_id, equipe_id, prenom, langue, jeton_hash, volontaire)
  values (
    p_evenement.id, v_equipe.id, btrim(p_prenom), p_langue, p_jeton_hash,
    coalesce(p_volontaire, false) and p_jeton_hash is not null
  )
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
  public.placer_joueur(public.evenements, text, public.langue, text, uuid, boolean)
  from public, anon, authenticated;

create function public.rejoindre_evenement(
  p_code text,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid default null,
  p_volontaire boolean default false
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

  return public.placer_joueur(v_evenement, p_prenom, p_langue, p_jeton_hash, p_groupe, p_volontaire);
end;
$$;

-- Comme avant : seul le serveur de l'app appelle l'arrivée.
revoke execute on function
  public.rejoindre_evenement(text, text, public.langue, text, uuid, boolean)
  from public, anon, authenticated;

grant execute on function
  public.rejoindre_evenement(text, text, public.langue, text, uuid, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- Le tirage des capitaines
-- ---------------------------------------------------------------------------

-- Pour chaque équipe sans capitaine : un volontaire au hasard, sinon un joueur avec téléphone.
-- Une équipe qui a déjà son capitaine le garde. Security invoker : la RLS de l'animateur
-- s'applique (il ne touche que ses soirées). Renvoie le nombre de capitaines nommés.
create function public.tirer_capitaines(p_evenement uuid) returns integer
language sql
security invoker
set search_path = ''
as $$
  with tires as (
    select distinct on (j.equipe_id) j.id
    from public.joueurs j
    join public.equipes eq on eq.id = j.equipe_id
    where j.evenement_id = p_evenement
      and j.jeton_hash is not null
      and not exists (
        select 1 from public.joueurs c where c.equipe_id = j.equipe_id and c.capitaine
      )
    order by j.equipe_id, j.volontaire desc, random()
  ),
  nommes as (
    update public.joueurs j set capitaine = true
    from tires where j.id = tires.id
    returning j.id
  )
  select count(*)::integer from nommes;
$$;

revoke execute on function public.tirer_capitaines(uuid) from public, anon;
grant execute on function public.tirer_capitaines(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Le capitaine renomme son équipe
-- ---------------------------------------------------------------------------

-- Refus, dans cet ordre : session inconnue, pas capitaine, nom figé, nom vide ou trop long
-- (24 caractères : la carte de l'écran commun le loge en entier).
create function public.renommer_equipe(p_jeton_hash text, p_nom text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_equipe public.equipes;
  v_nom text := btrim(coalesce(p_nom, ''));
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;

  if not v_joueur.capitaine or v_joueur.equipe_id is null then
    raise exception 'pas capitaine' using errcode = 'insufficient_privilege';
  end if;

  select * into v_equipe from public.equipes eq where eq.id = v_joueur.equipe_id for update;
  if v_equipe.nom_fige then
    raise exception 'nom figé' using errcode = 'check_violation';
  end if;

  if char_length(v_nom) not between 1 and 24 then
    raise exception 'nom invalide' using errcode = 'check_violation';
  end if;

  update public.equipes set nom = v_nom where id = v_equipe.id;
  return jsonb_build_object('equipe_id', v_equipe.id, 'nom', v_nom);
end;
$$;

revoke execute on function public.renommer_equipe(text, text) from public, anon, authenticated;
grant execute on function public.renommer_equipe(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Le téléphone sait si le nom est figé ; l'écran voit les changements de nom
-- ---------------------------------------------------------------------------

-- Reprise de 20261017090000_invites_sans_telephone.sql, `equipe.nom_fige` en plus.
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
      'nom_fige', eq.nom_fige,
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

-- Un nom changé depuis un téléphone n'est couvert par aucun signal de la régie : l'écran
-- écoute les mises à jour des équipes (rares).
alter publication supabase_realtime add table public.equipes;
