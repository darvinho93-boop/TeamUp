-- Ciné-mime (2026-11-20) : le Mime d'une scène de film.
--
-- Une équipe à la fois, partagée en groupes en salle. Le groupe 1 regarde la scène sur l'écran
-- commun, sans le son (les autres groupes sont dos tourné), la mime au groupe 2, et ainsi de
-- suite ; le dernier groupe donne le film. Un seul chrono pour la chaîne, +100 si le film est
-- trouvé. Au verdict, la scène rejoue avec le son pour toute la salle.
--
-- Écart assumé à « 5 jeux et 2 duels » (spec v3), comme le Blind test et le Portrait mystère.
--
-- Un contenu « Ciné-mime » : public `{}`, secret `{film}` par langue, et sa vidéo
-- (`contenus.extrait`, un MP4 du bucket privé « extraits », déposé au back-office). Les passages
-- se tirent dans une réserve à la formation des équipes, comme Points communs et le Mime.
-- Aucun téléphone ne reçoit ni le film ni la vidéo.

insert into public.jeux (code, nom, sequentiel, chrono_passage_s, beta, ordre_affichage)
values ('cinemime', 'Ciné-mime', true, 195, false, 10)
on conflict (code) do nothing;

-- Les jeux joués une équipe à la fois : leurs passages se tirent à la formation des équipes.
create function public.jeu_par_equipe(p_jeu public.jeu) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_jeu in ('list2', 'mime2', 'cinemime');
$$;

-- ---------------------------------------------------------------------------
-- Contenus : la forme du nouveau jeu, et sa vidéo
-- ---------------------------------------------------------------------------

-- Reprise de 20261119100000_portrait_mystere.sql : le Ciné-mime en plus.
create or replace function public.contenu_bien_forme(p_jeu public.jeu, p_public jsonb, p_secret jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_jeu
    when 'list2' then
      public.texte_rempli(p_public -> 'consigne')
      and public.texte_rempli(p_secret -> 'reponse')
      and jsonb_typeof(p_secret -> 'indices') = 'array'
      and jsonb_array_length(p_secret -> 'indices') = 2
      and public.texte_rempli(p_secret -> 'indices' -> 0)
      and public.texte_rempli(p_secret -> 'indices' -> 1)
    when 'qcm2' then
      public.texte_rempli(p_public -> 'question')
      and jsonb_typeof(p_public -> 'propositions') = 'array'
      and jsonb_array_length(p_public -> 'propositions') = 4
      and public.texte_rempli(p_public -> 'propositions' -> 0)
      and public.texte_rempli(p_public -> 'propositions' -> 1)
      and public.texte_rempli(p_public -> 'propositions' -> 2)
      and public.texte_rempli(p_public -> 'propositions' -> 3)
      and jsonb_typeof(p_secret -> 'bonne') = 'number'
      and (p_secret ->> 'bonne') in ('0', '1', '2', '3')
    when 'enchere2' then
      public.texte_rempli(p_public -> 'theme') and public.texte_rempli(p_secret -> 'sujet')
    when 'mime2' then
      p_public = '{}'::jsonb and public.texte_rempli(p_secret -> 'mot')
    when 'photo2' then
      public.texte_rempli(p_public -> 'theme') and p_secret is null
    when 'portrait' then
      public.texte_rempli(p_public -> 'nom')
      and char_length(p_public ->> 'nom') <= 60
      and jsonb_typeof(p_secret -> 'indices') = 'array'
      and jsonb_array_length(p_secret -> 'indices') = 3
      and public.texte_rempli(p_secret -> 'indices' -> 0)
      and public.texte_rempli(p_secret -> 'indices' -> 1)
      and public.texte_rempli(p_secret -> 'indices' -> 2)
      and (select bool_and(char_length(i) <= 200)
           from jsonb_array_elements_text(p_secret -> 'indices') i)
    when 'cinemime' then
      p_public = '{}'::jsonb
      and public.texte_rempli(p_secret -> 'film')
      and char_length(p_secret ->> 'film') <= 80
    else false
  end
  -- Rien d'autre que les clés attendues : un secret ne se glisse pas dans la partie publique.
  and not exists (
    select 1 from jsonb_object_keys(p_public) k
    where k <> all (case p_jeu
      when 'list2' then array['consigne']
      when 'qcm2' then array['question', 'propositions']
      when 'enchere2' then array['theme']
      when 'photo2' then array['theme']
      when 'portrait' then array['nom']
      else array[]::text[] end)
  );
$$;

-- La vidéo d'une scène : `{uuid}.mp4` dans le bucket « extraits », un uuid neuf à chaque dépôt ;
-- sa durée, lue par le navigateur au dépôt, règle le chrono de la scène. Présentes si et
-- seulement si le contenu est un Ciné-mime.
alter table public.contenus
  add column extrait text unique
    check (extrait ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$'),
  add column extrait_duree_ms integer check (extrait_duree_ms between 3000 and 90000),
  add constraint contenus_extrait_cinemime check (
    (jeu = 'cinemime') = (extrait is not null)
    and (extrait is null) = (extrait_duree_ms is null)
  );

comment on column public.contenus.extrait is
  'Ciné-mime : la vidéo de la scène, chemin du bucket privé « extraits ».';

-- Reprise de 20261003090000_back_office.sql : la vidéo du Ciné-mime en plus, dans la même
-- transaction que le contenu.
drop function public.enregistrer_contenu(uuid, public.jeu, public.etiquette, jsonb);

create function public.enregistrer_contenu(
  p_id uuid,
  p_jeu public.jeu,
  p_etiquette public.etiquette,
  p_langues jsonb,
  p_extrait jsonb default null
) returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_langue text;
  v_bloc jsonb;
  v_bonne text;
  v_chemin text := p_extrait ->> 'chemin';
  v_duree integer;
begin
  if not public.est_admin() then
    raise exception 'réservé aux admins' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_langues) is distinct from 'object' or not p_langues ? 'fr' then
    raise exception 'le français est obligatoire' using errcode = 'check_violation';
  end if;

  for v_langue, v_bloc in select * from jsonb_each(p_langues) loop
    if v_langue not in ('fr', 'en', 'ta') then
      raise exception 'langue inconnue : %', v_langue using errcode = 'check_violation';
    end if;
    if jsonb_typeof(v_bloc -> 'public') is distinct from 'object'
      or not public.contenu_bien_forme(p_jeu, v_bloc -> 'public', v_bloc -> 'secret') then
      raise exception 'contenu mal formé (%)', v_langue using errcode = 'check_violation';
    end if;
    if p_jeu = 'qcm2' then
      if v_bonne is not null and v_bonne <> (v_bloc -> 'secret' ->> 'bonne') then
        raise exception 'la bonne réponse diffère selon la langue' using errcode = 'check_violation';
      end if;
      v_bonne := v_bloc -> 'secret' ->> 'bonne';
    end if;
  end loop;

  -- Ciné-mime (2026-11-20) : la vidéo de la scène, déposée d'abord dans le bucket « extraits ».
  -- Absente à la modification, celle d'avant reste.
  if p_extrait is not null then
    if p_jeu <> 'cinemime' or jsonb_typeof(p_extrait -> 'duree_ms') is distinct from 'number' then
      raise exception 'extrait inattendu' using errcode = 'check_violation';
    end if;
    v_duree := round((p_extrait ->> 'duree_ms')::numeric);
  elsif p_jeu = 'cinemime' and v_id is null then
    raise exception 'la vidéo de la scène est obligatoire' using errcode = 'check_violation';
  end if;

  if v_id is null then
    insert into public.contenus (jeu, etiquette, cree_par, extrait, extrait_duree_ms)
    values (p_jeu, p_etiquette, (select auth.uid()), v_chemin, v_duree)
    returning id into v_id;
  else
    -- Le jeu d'un contenu ne change pas : ses passages en dépendent.
    update public.contenus c
    set etiquette = p_etiquette,
        extrait = coalesce(v_chemin, c.extrait),
        extrait_duree_ms = coalesce(v_duree, c.extrait_duree_ms)
    where c.id = v_id and c.jeu = p_jeu;
    if not found then
      raise exception 'contenu introuvable' using errcode = 'no_data_found';
    end if;
  end if;

  delete from public.contenus_traductions t
  where t.contenu_id = v_id and not p_langues ? t.langue::text;
  delete from public.contenus_secrets s
  where s.contenu_id = v_id and not p_langues ? s.langue::text;

  insert into public.contenus_traductions (contenu_id, langue, valeur)
  select v_id, l.key::public.langue, l.value -> 'public'
  from jsonb_each(p_langues) l
  on conflict (contenu_id, langue) do update set valeur = excluded.valeur;

  insert into public.contenus_secrets (contenu_id, langue, valeur)
  select v_id, l.key::public.langue, l.value -> 'secret'
  from jsonb_each(p_langues) l
  where p_jeu <> 'photo2'
  on conflict (contenu_id, langue) do update set valeur = excluded.valeur;

  return v_id;
end;
$$;

revoke execute on function
  public.enregistrer_contenu(uuid, public.jeu, public.etiquette, jsonb, jsonb)
  from public, anon;
grant execute on function
  public.enregistrer_contenu(uuid, public.jeu, public.etiquette, jsonb, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Le bucket des scènes
-- ---------------------------------------------------------------------------

-- Privé : ce sont des extraits de films. L'écran commun les lit par URL signée, sous la session
-- de l'animateur, comme les musiques. MP4 seul, 40 Mo au plus.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('extraits', 'extraits', false, 41943040, array['video/mp4'])
on conflict (id) do nothing;

create policy "animateur lit les extraits" on storage.objects
  for select to authenticated
  using (bucket_id = 'extraits' and public.est_animateur());

create policy "admin dépose un extrait" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'extraits'
    and public.est_admin()
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$'
  );

-- Pour retirer la vidéo remplacée d'un contenu, ou défaire un dépôt dont le contenu n'a pas pu
-- s'enregistrer.
create policy "admin retire un extrait" on storage.objects
  for delete to authenticated
  using (bucket_id = 'extraits' and public.est_admin());

-- ---------------------------------------------------------------------------
-- Ce que voient l'écran et la régie
-- ---------------------------------------------------------------------------

-- Reprise de 20261119100000_portrait_mystere.sql : le Ciné-mime en plus.
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
  elsif p_jeu = 'cinemime' then
    -- Ciné-mime (2026-11-20) : le titre du film au verdict seulement. La scène, elle, passe à
    -- l'écran sans le son à l'étape « extrait » ; son titre n'y paraît jamais avant.
    if p_passage.statut = 'termine' then
      return v_secret;
    end if;
  elsif p_jeu = 'portrait' then
    -- Portrait mystère (2026-11-18) : les indices déjà donnés, tous une fois la cible révélée.
    if p_passage.statut = 'termine' then
      return v_secret;
    elsif v_courant and p_pilotage.etape in ('vote', 'tour') and p_pilotage.indices > 0 then
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
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Formation des équipes : le Ciné-mime se tire comme Points communs et le Mime
-- ---------------------------------------------------------------------------

-- Reprise de 20261101090000_inscription_et_formation.sql : `jeu_par_equipe` à la place de la
-- liste recopiée.
create or replace function public.former_equipes(p_evenement uuid, p_equipes jsonb, p_passages jsonb)
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
    and public.jeu_par_equipe(m.jeu)
    and not (m.options ? 'reserve');

  -- Les passages par équipe se refont depuis la réserve ; les anciennes équipes partent.
  delete from public.passages p
  using public.manches m
  where m.id = p.manche_id and m.evenement_id = p_evenement and public.jeu_par_equipe(m.jeu);
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
         and public.jeu_par_equipe(m.jeu)
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
  where m.evenement_id = p_evenement and public.jeu_par_equipe(m.jeu);

  return v_n;
end;
$$;

create or replace function public.equipes_retirer_passages() returns trigger
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
    and public.jeu_par_equipe(m.jeu);
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- etat_ecran : reprise de 20261121090000_bruitages_habillage.sql, complétée
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
            -- Ciné-mime (2026-11-20) : la vidéo de la scène, un chemin du bucket privé « extraits »
            -- (un uuid, il ne dit rien du film) ; l'écran précharge tout à son ouverture.
            'extrait', case when m.jeu = 'cinemime' then (
              select jsonb_build_object('chemin', c.extrait, 'duree_ms', c.extrait_duree_ms)
              from public.contenus c where c.id = pa.contenu_id) end,
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
