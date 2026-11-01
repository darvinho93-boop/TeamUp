-- Inscription en amont et formation des équipes par la régie (lot 14, tranché le 2026-11-01).
--
-- Une soirée sans équipe reçoit des inscrits sans équipe : prénom, groupe, et pour un volontaire
-- capitaine, un nom d'équipe proposé. La régie forme les équipes quand elle le décide
-- (`former_equipes`) : groupes mélangés, un capitaine par équipe, et les contenus de Points communs
-- et du Mime tirés dans la réserve de chaque manche. Une soirée qui a déjà ses équipes garde le
-- comportement du lot 5 : l'arrivant va dans l'équipe la moins remplie.
--
-- Écart assumé au lot 11 : le groupe d'un inscrit est gardé sur lui, avec son nom proposé,
-- jusqu'au premier jeu commencé (la régie peut refaire les équipes d'ici là), puis effacé.
--
-- Garde-fou de la panne du 2026-10-31 : supprimer une équipe supprime ses passages à venir de
-- Points communs et du Mime, au lieu de les laisser sans équipe.

-- ---------------------------------------------------------------------------
-- Colonnes
-- ---------------------------------------------------------------------------

alter table public.evenements
  add column equipes_prevues smallint not null default 4 check (equipes_prevues between 2 and 8);

comment on column public.evenements.equipes_prevues is
  'Nombre d''équipes prévu à la création : durée prévue du programme, valeur proposée à la '
  'formation des équipes (lot 14).';

update public.evenements e
set equipes_prevues = least(8, greatest(2, (
  select count(*) from public.equipes q where q.evenement_id = e.id
)))
where exists (select 1 from public.equipes q where q.evenement_id = e.id);

alter table public.joueurs
  add column groupe_id uuid,
  add column nom_propose text check (char_length(nom_propose) between 1 and 24),
  add foreign key (groupe_id, evenement_id)
    references public.groupes (id, evenement_id) on delete set null (groupe_id),
  add constraint joueurs_nom_propose_volontaire check (nom_propose is null or volontaire);

comment on column public.joueurs.groupe_id is
  'Groupe choisi à l''inscription, gardé jusqu''au premier jeu commencé pour la formation des '
  'équipes, puis effacé (lot 14).';
comment on column public.joueurs.nom_propose is
  'Nom d''équipe proposé par un volontaire capitaine, gardé jusqu''au premier jeu commencé.';

-- ---------------------------------------------------------------------------
-- Arrivée : sans équipe tant que la régie ne les a pas formées
-- ---------------------------------------------------------------------------

drop function public.rejoindre_evenement(text, text, public.langue, text, uuid, boolean);
drop function public.placer_joueur(public.evenements, text, public.langue, text, uuid, boolean);

-- Reprise de 20261023110000_prenoms_uniques.sql, le nom proposé et la soirée sans équipe en plus.
create function public.placer_joueur(
  p_evenement public.evenements,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid,
  p_volontaire boolean default false,
  p_nom_propose text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_equipe public.equipes;
  v_volontaire boolean := coalesce(p_volontaire, false) and p_jeton_hash is not null;
  v_nom text := nullif(btrim(coalesce(p_nom_propose, '')), '');
  v_garder_groupe boolean;
begin
  if p_langue <> all (p_evenement.langues) then
    raise exception 'langue non proposée pour cet événement' using errcode = 'check_violation';
  end if;

  if p_groupe is not null and not exists (
    select 1 from public.groupes g where g.id = p_groupe and g.evenement_id = p_evenement.id
  ) then
    raise exception 'groupe inconnu' using errcode = 'check_violation';
  end if;

  if v_nom is not null and char_length(v_nom) > 24 then
    raise exception 'nom d''équipe trop long' using errcode = 'check_violation';
  end if;

  -- Une arrivée à la fois par événement, jusqu'à la fin de la transaction : les effectifs lus
  -- voient toujours les arrivées précédentes. `former_equipes` prend le même verrou.
  perform pg_advisory_xact_lock(hashtextextended(p_evenement.id::text, 0));

  if (select count(*) from public.joueurs j where j.evenement_id = p_evenement.id) >= 150 then
    raise exception 'événement complet' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.joueurs j
    where j.evenement_id = p_evenement.id
      and public.cle_prenom(j.prenom) = public.cle_prenom(p_prenom)
  ) then
    raise exception 'prénom déjà pris' using errcode = 'unique_violation';
  end if;

  if not exists (select 1 from public.equipes eq where eq.evenement_id = p_evenement.id) then
    -- Pas encore d'équipes : l'inscrit attend la formation (lot 14).
    v_equipe := null;
  elsif p_groupe is null then
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

    insert into public.equipes_groupes (evenement_id, equipe_id, groupe_id, effectif)
    values (p_evenement.id, v_equipe.id, p_groupe, 1)
    on conflict (equipe_id, groupe_id) do update set effectif = public.equipes_groupes.effectif + 1;
  end if;

  -- Groupe et nom proposé servent à (re)former les équipes : gardés tant qu'aucun jeu n'a commencé.
  v_garder_groupe := not exists (
    select 1 from public.manches m
    where m.evenement_id = p_evenement.id and m.statut <> 'a_venir'
  );

  -- Un invité sans téléphone n'est jamais volontaire : il ne pourrait pas être capitaine.
  insert into public.joueurs (
    evenement_id, equipe_id, prenom, langue, jeton_hash, volontaire, groupe_id, nom_propose
  )
  values (
    p_evenement.id, v_equipe.id, btrim(p_prenom), p_langue, p_jeton_hash, v_volontaire,
    case when v_garder_groupe then p_groupe end,
    case when v_garder_groupe and v_volontaire then v_nom end
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
  public.placer_joueur(public.evenements, text, public.langue, text, uuid, boolean, text)
  from public, anon, authenticated;

-- Reprise de 20261022100000_groupe_facultatif.sql, le nom proposé en plus.
create function public.rejoindre_evenement(
  p_code text,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid default null,
  p_volontaire boolean default false,
  p_nom_propose text default null
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

  if p_groupe is null and not v_evenement.groupe_facultatif and exists (
    select 1 from public.groupes g where g.evenement_id = v_evenement.id
  ) then
    raise exception 'groupe obligatoire' using errcode = 'check_violation';
  end if;

  return public.placer_joueur(
    v_evenement, p_prenom, p_langue, p_jeton_hash, p_groupe, p_volontaire, p_nom_propose
  );
end;
$$;

revoke execute on function
  public.rejoindre_evenement(text, text, public.langue, text, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function
  public.rejoindre_evenement(text, text, public.langue, text, uuid, boolean, text)
  to service_role;

-- Le volontaire change le nom qu'il propose, tant que les équipes ne sont pas formées.
create function public.proposer_nom(p_jeton_hash text, p_nom text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_nom text := nullif(btrim(coalesce(p_nom, '')), '');
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;
  if not v_joueur.volontaire then
    raise exception 'réservé aux volontaires' using errcode = 'insufficient_privilege';
  end if;
  if v_joueur.equipe_id is not null then
    raise exception 'équipes déjà formées' using errcode = 'PT409';
  end if;
  if v_nom is not null and char_length(v_nom) > 24 then
    raise exception 'nom d''équipe trop long' using errcode = 'check_violation';
  end if;
  update public.joueurs set nom_propose = v_nom where id = v_joueur.id;
  return jsonb_build_object('nom_propose', v_nom);
end;
$$;

revoke execute on function public.proposer_nom(text, text) from public, anon, authenticated;
grant execute on function public.proposer_nom(text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Formation des équipes par la régie
-- ---------------------------------------------------------------------------

-- La régie calcule la formation (packages/game : `formerEquipes`, `tirerContenus`, hasard du
-- navigateur) et l'écrit ici d'un bloc. `p_equipes` : [{numero, nom, capitaine, membres[]}] ;
-- `p_passages` : [{manche_id, numero, contenu_id, ordre}]. Les équipes existantes sont remplacées,
-- ce qui permet de refaire les équipes tant qu'aucun jeu n'a commencé.
create function public.former_equipes(p_evenement uuid, p_equipes jsonb, p_passages jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evenement public.evenements;
  v_n integer := coalesce(jsonb_array_length(p_equipes), 0);
  v_eq jsonb;
  v_id uuid;
  v_restant record;
begin
  if not public.anime(p_evenement) then
    raise exception 'événement inconnu' using errcode = 'insufficient_privilege';
  end if;
  select * into v_evenement from public.evenements e where e.id = p_evenement;
  if v_evenement.statut = 'termine' then
    raise exception 'événement clos' using errcode = 'check_violation';
  end if;

  -- Sous le verrou d'arrivée : un inscrit qui arrive pendant la formation l'attend, puis va dans
  -- la moins remplie des équipes formées.
  perform pg_advisory_xact_lock(hashtextextended(p_evenement::text, 0));

  if exists (
    select 1 from public.manches m where m.evenement_id = p_evenement and m.statut <> 'a_venir'
  ) then
    raise exception 'un jeu a déjà commencé' using errcode = 'PT409';
  end if;

  -- Refaire les équipes effacerait leurs photos et leurs points (suppression en cascade).
  if exists (select 1 from public.photos ph where ph.evenement_id = p_evenement)
    or exists (select 1 from public.scores s where s.evenement_id = p_evenement)
  then
    raise exception 'photos ou points déjà enregistrés' using errcode = 'PT409';
  end if;

  if v_n < 2 or v_n > 8
    or (select array_agg((x ->> 'numero')::int order by (x ->> 'numero')::int)
        from jsonb_array_elements(p_equipes) x) <> (select array_agg(i) from generate_series(1, v_n) i)
    or exists (
      select 1 from jsonb_array_elements(p_equipes) x
      where char_length(btrim(coalesce(x ->> 'nom', ''))) not between 1 and 60
    )
  then
    raise exception 'équipes invalides' using errcode = 'check_violation';
  end if;

  -- Une manche par équipe sans réserve (préparée avant le lot 14) : ses contenus deviennent sa
  -- réserve, la régie y a tiré ses passages de la même façon.
  update public.manches m
  set options = m.options || jsonb_build_object('reserve', coalesce((
    select jsonb_agg(p.contenu_id order by p.ordre)
    from public.passages p where p.manche_id = m.id and p.contenu_id is not null
  ), '[]'::jsonb))
  where m.evenement_id = p_evenement
    and m.jeu in ('list2', 'mime2')
    and not (m.options ? 'reserve');

  -- Les passages par équipe se refont depuis la réserve ; les anciennes équipes partent.
  delete from public.passages p
  using public.manches m
  where m.id = p.manche_id and m.evenement_id = p_evenement and m.jeu in ('list2', 'mime2');
  update public.joueurs set capitaine = false where evenement_id = p_evenement and capitaine;
  delete from public.equipes where evenement_id = p_evenement;

  for v_eq in select * from jsonb_array_elements(p_equipes) loop
    insert into public.equipes (evenement_id, numero, nom)
    values (p_evenement, (v_eq ->> 'numero')::smallint, btrim(v_eq ->> 'nom'))
    returning id into v_id;

    update public.joueurs j
    set equipe_id = v_id
    where j.evenement_id = p_evenement
      and j.id in (select (m #>> '{}')::uuid from jsonb_array_elements(v_eq -> 'membres') m);

    if v_eq ->> 'capitaine' is not null then
      update public.joueurs j
      set capitaine = true
      where j.id = (v_eq ->> 'capitaine')::uuid
        and j.equipe_id = v_id
        and j.jeton_hash is not null;
    end if;
  end loop;

  -- Les inscrits que la régie n'avait pas encore vus : dans la moins remplie, un par un.
  for v_restant in
    select j.id from public.joueurs j
    where j.evenement_id = p_evenement and j.equipe_id is null
    order by j.rejoint_le
  loop
    update public.joueurs set equipe_id = (
      select eq.id from public.equipes eq
      where eq.evenement_id = p_evenement
      order by (select count(*) from public.joueurs x where x.equipe_id = eq.id), eq.numero
      limit 1
    ) where id = v_restant.id;
  end loop;

  -- La répartition des groupes, recomptée sur les inscrits (lot 11 : affichée à la Salle et
  -- utilisée pour placer les retardataires).
  insert into public.equipes_groupes (evenement_id, equipe_id, groupe_id, effectif)
  select p_evenement, j.equipe_id, j.groupe_id, count(*)
  from public.joueurs j
  where j.evenement_id = p_evenement and j.groupe_id is not null and j.equipe_id is not null
  group by j.equipe_id, j.groupe_id;

  -- Les passages tirés dans la réserve, pour les équipes formées.
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_passages, '[]'::jsonb)) x
    left join public.manches m
      on m.id = (x ->> 'manche_id')::uuid and m.evenement_id = p_evenement
         and m.jeu in ('list2', 'mime2')
    where m.id is null
       or not coalesce(m.options -> 'reserve', '[]'::jsonb) ? (x ->> 'contenu_id')
       or not exists (
         select 1 from public.equipes eq
         where eq.evenement_id = p_evenement and eq.numero = (x ->> 'numero')::smallint
       )
  ) then
    raise exception 'passages invalides' using errcode = 'check_violation';
  end if;

  insert into public.passages (manche_id, evenement_id, equipe_id, ordre, contenu_id)
  select (x ->> 'manche_id')::uuid, p_evenement, eq.id, (x ->> 'ordre')::smallint,
         (x ->> 'contenu_id')::uuid
  from jsonb_array_elements(coalesce(p_passages, '[]'::jsonb)) x
  join public.equipes eq
    on eq.evenement_id = p_evenement and eq.numero = (x ->> 'numero')::smallint;

  -- L'ordre de passage se tire de nouveau, sur les nouvelles équipes (lot 13).
  update public.manches m
  set options = m.options - 'ordre_tire'
  where m.evenement_id = p_evenement and m.jeu in ('list2', 'mime2');

  return v_n;
end;
$$;

revoke execute on function public.former_equipes(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.former_equipes(uuid, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Garde-fous
-- ---------------------------------------------------------------------------

-- Panne du 2026-10-31 : une équipe supprimée laissait ses passages de Points communs et de Mime
-- sans équipe, et le jeu se bloquait dessus. Ses passages à venir partent désormais avec elle.
create function public.equipes_retirer_passages() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.passages p
  using public.manches m
  where p.equipe_id = old.id
    and p.statut = 'a_venir'
    and m.id = p.manche_id
    and m.jeu in ('list2', 'mime2');
  return old;
end;
$$;

create trigger equipes_retirer_passages
  before delete on public.equipes
  for each row execute function public.equipes_retirer_passages();

-- Au premier jeu commencé, les équipes ne se refont plus : groupe et nom proposé s'effacent.
create function public.manches_oublier_inscription() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.joueurs
  set groupe_id = null, nom_propose = null
  where evenement_id = new.evenement_id
    and (groupe_id is not null or nom_propose is not null);
  return new;
end;
$$;

create trigger manches_oublier_inscription
  after update of statut on public.manches
  for each row
  when (old.statut = 'a_venir' and new.statut <> 'a_venir')
  execute function public.manches_oublier_inscription();

-- ---------------------------------------------------------------------------
-- Ce que voit le téléphone
-- ---------------------------------------------------------------------------

-- Reprise de 20261031090000_relecture_du_joueur_allegee.sql : volontaire, nom proposé et les jeux
-- du programme (la page d'explication de l'inscription) en plus.
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
    'photos', public.photos_du_joueur(j)
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  where j.jeton_hash = p_jeton_hash;
$$;
