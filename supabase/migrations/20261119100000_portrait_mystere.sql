-- Portrait mystère (2026-11-18) : une grille de 25 noms, une cible par passage, trois indices
-- préparés, un par tour. À chaque tour, toutes les équipes encore en lice votent pour une carte :
-- trouver au tour 1, 2 ou 3 vaut 100, 60 ou 30 points. Une carte noire est cachée dans la grille :
-- l'équipe qui la vote est éliminée du jeu ; la carte ne se montre qu'à la fin.
--
-- Où vit quoi :
--   - les cibles : `passages.contenu_id`, dans l'ordre des passages (comme les autres jeux) ;
--   - la grille : `grilles_portrait`, une par manche (25 contenus et la position de la noire) ;
--   - les votes : `votes_portrait`, un par passage, équipe et tour, écrits par `voter_portrait`
--     (le capitaine, rôle de service) ou `voter_portrait_regie` (la régie, mode à voix) ;
--   - le tour en cours : `pilotage.indices` (indices donnés) ; l'étape : `pilotage.etape`
--     (`pret`, `vote`, `tour`, `revele`, `noire`) ;
--   - le résultat d'un passage (écrit par la régie à la fin de chaque tour) :
--     `{ trouvees: { numéro: tour }, eliminees: [numéros], tours: n }`.
-- Les contenus « Portrait mystère » : public `{nom}`, secret `{indices: [3]}`. Un contenu peut
-- appartenir à une soirée (`contenus.evenement_id`) : les proches, saisis à la préparation.

insert into public.jeux (code, nom, sequentiel, chrono_passage_s, beta, ordre_affichage)
values ('portrait', 'Portrait mystère', false, 90, false, 9)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Contenus : la forme du nouveau jeu, et les proches d'une soirée
-- ---------------------------------------------------------------------------

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

-- Null : la banque de Team Up!, lue par tout animateur. Une soirée : ses proches, lus par son
-- animateur seulement (et l'admin), supprimés avec elle.
alter table public.contenus
  add column evenement_id uuid references public.evenements (id) on delete cascade;

comment on column public.contenus.evenement_id is
  'Contenu propre à une soirée (les proches du Portrait mystère) ; null pour la banque.';

create index contenus_evenement_idx on public.contenus (evenement_id) where evenement_id is not null;

-- Un contenu de la banque, ou un proche d'une soirée que j'anime.
create function public.contenu_lisible(p_contenu uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contenus c
    where c.id = p_contenu and (c.evenement_id is null or public.anime(c.evenement_id))
  );
$$;

revoke execute on function public.contenu_lisible(uuid) from public, anon;
grant execute on function public.contenu_lisible(uuid) to authenticated;

drop policy "animateur lit les contenus" on public.contenus;
create policy "animateur lit les contenus" on public.contenus
  for select to authenticated
  using (public.est_animateur() and (evenement_id is null or public.anime(evenement_id)));

drop policy "animateur lit les traductions" on public.contenus_traductions;
create policy "animateur lit les traductions" on public.contenus_traductions
  for select to authenticated
  using (public.est_animateur() and public.contenu_lisible(contenu_id));

drop policy "animateur lit les secrets" on public.contenus_secrets;
create policy "animateur lit les secrets" on public.contenus_secrets
  for select to authenticated
  using (public.est_animateur() and public.contenu_lisible(contenu_id));

-- Un proche de la soirée (nom et trois indices), dans toutes les langues de la soirée et elles
-- seules, par l'animateur de la soirée. `p_id` : le modifier ; `p_actif` faux : le retirer des
-- menus (rien ne se supprime, ses passages en dépendent peut-être).
create function public.enregistrer_proche(
  p_evenement uuid,
  p_id uuid,
  p_langues jsonb,
  p_actif boolean default true
) returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_langues public.langue[];
  v_langue text;
  v_bloc jsonb;
begin
  if not public.anime(p_evenement) then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
  select e.langues into v_langues from public.evenements e where e.id = p_evenement;
  if jsonb_typeof(p_langues) is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_langues)) <> cardinality(v_langues)
    or exists (select 1 from unnest(v_langues) l where not p_langues ? l::text)
  then
    raise exception 'les langues de la soirée sont obligatoires' using errcode = 'check_violation';
  end if;
  for v_langue, v_bloc in select * from jsonb_each(p_langues) loop
    if jsonb_typeof(v_bloc -> 'public') is distinct from 'object'
      or not public.contenu_bien_forme('portrait', v_bloc -> 'public', v_bloc -> 'secret') then
      raise exception 'proche mal formé (%)', v_langue using errcode = 'check_violation';
    end if;
  end loop;

  if v_id is null then
    insert into public.contenus (jeu, etiquette, cree_par, evenement_id)
    values ('portrait', 'tout_public', (select auth.uid()), p_evenement)
    returning id into v_id;
  else
    update public.contenus c set actif = coalesce(p_actif, true)
    where c.id = v_id and c.evenement_id = p_evenement and c.jeu = 'portrait';
    if not found then
      raise exception 'proche introuvable' using errcode = 'no_data_found';
    end if;
  end if;

  insert into public.contenus_traductions (contenu_id, langue, valeur)
  select v_id, l.key::public.langue, l.value -> 'public'
  from jsonb_each(p_langues) l
  on conflict (contenu_id, langue) do update set valeur = excluded.valeur;

  insert into public.contenus_secrets (contenu_id, langue, valeur)
  select v_id, l.key::public.langue, l.value -> 'secret'
  from jsonb_each(p_langues) l
  on conflict (contenu_id, langue) do update set valeur = excluded.valeur;

  return v_id;
end;
$$;

revoke execute on function public.enregistrer_proche(uuid, uuid, jsonb, boolean) from public, anon;
grant execute on function public.enregistrer_proche(uuid, uuid, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- La grille et les votes
-- ---------------------------------------------------------------------------

-- 25 contenus tous différents.
create function public.cartes_portrait_valides(p_cartes uuid[]) returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_cartes) = 25
    and array_position(p_cartes, null) is null
    and (select count(distinct c) from unnest(p_cartes) c) = 25;
$$;

create table public.grilles_portrait (
  manche_id uuid primary key references public.manches (id) on delete cascade,
  cartes uuid[] not null check (public.cartes_portrait_valides(cartes)),
  -- Position (0 à 24) de la carte noire : secrète jusqu'à la fin du jeu.
  noire smallint not null check (noire between 0 and 24),
  maj_le timestamptz not null default now()
);

alter table public.grilles_portrait enable row level security;

create policy "animateur gère la grille de ses manches" on public.grilles_portrait
  for all to authenticated
  using (public.anime((select m.evenement_id from public.manches m where m.id = manche_id)))
  with check (public.anime((select m.evenement_id from public.manches m where m.id = manche_id)));

create table public.votes_portrait (
  passage_id uuid not null references public.passages (id) on delete cascade,
  equipe_id uuid not null references public.equipes (id) on delete cascade,
  tour smallint not null check (tour between 1 and 3),
  carte smallint not null check (carte between 0 and 24),
  vote_le timestamptz not null default clock_timestamp(),
  primary key (passage_id, equipe_id, tour)
);

alter table public.votes_portrait enable row level security;

create policy "animateur lit les votes de ses événements" on public.votes_portrait
  for select to authenticated
  using (public.anime((
    select m.evenement_id from public.passages pa
    join public.manches m on m.id = pa.manche_id
    where pa.id = passage_id)));

-- Les équipes (numéros) éliminées par la carte noire dans cette manche.
create function public.portrait_eliminees(p_manche uuid) returns integer[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(distinct e.numero::integer), '{}')
  from public.passages pa
  cross join lateral jsonb_array_elements_text(coalesce(pa.resultat -> 'eliminees', '[]'::jsonb))
    as e(numero)
  where pa.manche_id = p_manche;
$$;

-- Les positions des cibles déjà révélées : elles ne se votent plus.
create function public.portrait_retournees(p_manche uuid) returns integer[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg((c.i - 1)::integer order by c.i), '{}')
  from public.grilles_portrait g
  cross join lateral unnest(g.cartes) with ordinality as c(contenu, i)
  where g.manche_id = p_manche
    and exists (
      select 1 from public.passages pa
      where pa.manche_id = p_manche and pa.statut = 'termine' and pa.contenu_id = c.contenu);
$$;

revoke execute on function public.portrait_eliminees(uuid) from public, anon, authenticated;
revoke execute on function public.portrait_retournees(uuid) from public, anon, authenticated;
grant execute on function public.portrait_eliminees(uuid) to service_role;
grant execute on function public.portrait_retournees(uuid) to service_role;

-- Ce qu'un vote doit respecter, d'où qu'il vienne : équipe en lice (ni éliminée, ni ayant déjà
-- trouvé cette cible), carte de la grille pas encore retournée.
create function public.verifier_vote_portrait(
  p_manche uuid,
  p_passage public.passages,
  p_numero integer,
  p_carte integer
) returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_numero is null then
    raise exception 'sans équipe' using errcode = 'insufficient_privilege';
  end if;
  if p_numero = any (public.portrait_eliminees(p_manche)) then
    raise exception 'équipe éliminée' using errcode = 'PT403';
  end if;
  if coalesce(p_passage.resultat -> 'trouvees', '{}'::jsonb) ? p_numero::text then
    raise exception 'déjà trouvé' using errcode = 'PT409';
  end if;
  if p_carte is null or p_carte not between 0 and 24
    or p_carte = any (public.portrait_retournees(p_manche)) then
    raise exception 'carte invalide' using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.verifier_vote_portrait(uuid, public.passages, integer, integer)
  from public, anon, authenticated;
grant execute on function public.verifier_vote_portrait(uuid, public.passages, integer, integer)
  to service_role;

-- Le capitaine vote depuis son téléphone (mode téléphones). Rôle de service seulement : la route
-- `/api/partie/[code]/portrait` l'appelle avec le hash de la session. Le vote se change tant que
-- le tour est ouvert (heure de la base, une seconde de grâce).
create function public.voter_portrait(p_jeton_hash text, p_carte integer) returns jsonb
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
  v_numero integer;
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;
  if not v_joueur.capitaine or v_joueur.equipe_id is null then
    raise exception 'pas capitaine' using errcode = 'insufficient_privilege';
  end if;

  select * into v_pilotage from public.pilotage pi where pi.evenement_id = v_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  select * into v_passage from public.passages pa
  where pa.id = v_pilotage.passage_id and pa.manche_id = v_manche.id;
  if v_manche.jeu is distinct from 'portrait'
    or v_manche.options ->> 'mode' is distinct from 'telephones'
    or v_pilotage.scene <> 'jeu'
    or v_passage.id is null
    or v_pilotage.etape is distinct from 'vote'
    or v_pilotage.chrono_depart is null
    or now() > v_pilotage.chrono_depart
      + make_interval(secs => coalesce(v_pilotage.chrono_duree_s, 0) + 1)
  then
    raise exception 'tour fermé' using errcode = 'PT409';
  end if;

  select eq.numero into v_numero from public.equipes eq where eq.id = v_joueur.equipe_id;
  perform public.verifier_vote_portrait(v_manche.id, v_passage, v_numero, p_carte);

  insert into public.votes_portrait (passage_id, equipe_id, tour, carte)
  values (v_passage.id, v_joueur.equipe_id, v_pilotage.indices, p_carte)
  on conflict (passage_id, equipe_id, tour)
    do update set carte = excluded.carte, vote_le = clock_timestamp();

  return jsonb_build_object('evenement_id', v_joueur.evenement_id);
end;
$$;

revoke execute on function public.voter_portrait(text, integer) from public, anon, authenticated;
grant execute on function public.voter_portrait(text, integer) to service_role;

-- La régie saisit le vote d'une équipe (mode à voix, ou en secours d'un téléphone), pendant le
-- tour, chrono écoulé ou non. `p_carte` null : retirer le vote saisi par erreur.
create function public.voter_portrait_regie(p_passage uuid, p_equipe uuid, p_carte integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_passage public.passages;
  v_manche public.manches;
  v_pilotage public.pilotage;
  v_numero integer;
begin
  select * into v_passage from public.passages pa where pa.id = p_passage;
  select * into v_manche from public.manches m where m.id = v_passage.manche_id;
  if v_manche.id is null or not public.anime(v_manche.evenement_id) then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
  select * into v_pilotage from public.pilotage pi where pi.evenement_id = v_manche.evenement_id;
  if v_manche.jeu is distinct from 'portrait'
    or v_pilotage.passage_id is distinct from p_passage
    or v_pilotage.etape is distinct from 'vote'
  then
    raise exception 'tour fermé' using errcode = 'PT409';
  end if;
  select eq.numero into v_numero from public.equipes eq
  where eq.id = p_equipe and eq.evenement_id = v_manche.evenement_id;

  if p_carte is null then
    delete from public.votes_portrait v
    where v.passage_id = p_passage and v.equipe_id = p_equipe and v.tour = v_pilotage.indices;
    return;
  end if;
  perform public.verifier_vote_portrait(v_manche.id, v_passage, v_numero, p_carte);
  insert into public.votes_portrait (passage_id, equipe_id, tour, carte)
  values (p_passage, p_equipe, v_pilotage.indices, p_carte)
  on conflict (passage_id, equipe_id, tour)
    do update set carte = excluded.carte, vote_le = clock_timestamp();
end;
$$;

revoke execute on function public.voter_portrait_regie(uuid, uuid, integer) from public, anon;
grant execute on function public.voter_portrait_regie(uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Ce que voit un téléphone : jamais la cible, la carte noire ni les indices à venir
-- ---------------------------------------------------------------------------

create function public.portrait_du_joueur(p_joueur public.joueurs) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pilotage public.pilotage;
  v_manche public.manches;
  v_passage public.passages;
  v_grille public.grilles_portrait;
  v_numero integer;
  v_mode text;
  v_eliminee boolean;
  v_trouvee integer;
  v_vote smallint;
  v_ouvert boolean;
  v_retournees integer[];
begin
  select * into v_pilotage from public.pilotage pi where pi.evenement_id = p_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  if v_manche.jeu is distinct from 'portrait' or v_pilotage.scene <> 'jeu' then
    return null;
  end if;
  select * into v_passage from public.passages pa
  where pa.id = v_pilotage.passage_id and pa.manche_id = v_manche.id;
  select * into v_grille from public.grilles_portrait g where g.manche_id = v_manche.id;
  select eq.numero into v_numero from public.equipes eq where eq.id = p_joueur.equipe_id;

  v_mode := coalesce(v_manche.options ->> 'mode', 'voix');
  v_eliminee := v_numero is not null and v_numero = any (public.portrait_eliminees(v_manche.id));
  v_trouvee := (v_passage.resultat -> 'trouvees' ->> v_numero::text)::integer;
  v_retournees := public.portrait_retournees(v_manche.id);
  select v.carte into v_vote from public.votes_portrait v
  where v.passage_id = v_passage.id and v.equipe_id = p_joueur.equipe_id
    and v.tour = v_pilotage.indices;
  v_ouvert := v_pilotage.etape = 'vote'
    and v_pilotage.chrono_depart is not null
    and now() < v_pilotage.chrono_depart
      + make_interval(secs => coalesce(v_pilotage.chrono_duree_s, 0));

  return jsonb_build_object(
    'mode', v_mode,
    'serveur_ms', floor(extract(epoch from clock_timestamp()) * 1000),
    'etape', v_pilotage.etape,
    'cible', v_passage.ordre,
    'cibles', (select count(*) from public.passages pa where pa.manche_id = v_manche.id),
    'tour', v_pilotage.indices,
    'chrono_depart_ms', floor(extract(epoch from v_pilotage.chrono_depart) * 1000),
    'chrono_duree_s', v_pilotage.chrono_duree_s,
    'equipe', v_numero,
    'capitaine', p_joueur.capitaine and p_joueur.equipe_id is not null,
    'eliminee', v_eliminee,
    'trouvee', v_trouvee,
    'vote', v_vote,
    'peut_voter', p_joueur.capitaine and v_numero is not null and v_mode = 'telephones'
      and v_ouvert and not v_eliminee and v_trouvee is null,
    'cartes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nom', (
          select t.valeur ->> 'nom' from public.contenus_traductions t
          where t.contenu_id = c.contenu
          order by (t.langue = p_joueur.langue) desc, (t.langue = 'fr') desc
          limit 1),
        'retournee', (c.i - 1)::integer = any (v_retournees)
      ) order by c.i)
      from unnest(v_grille.cartes) with ordinality as c(contenu, i)), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.portrait_du_joueur(public.joueurs) from public, anon, authenticated;
grant execute on function public.portrait_du_joueur(public.joueurs) to service_role;

-- Reprise de 20261118090000_avis_joueurs.sql : `portrait` en plus.
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
    'portrait', public.portrait_du_joueur(j),
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

-- ---------------------------------------------------------------------------
-- Ce que voient l'écran et la régie
-- ---------------------------------------------------------------------------

-- Les indices donnés jusqu'ici à l'écran (tous une fois la cible révélée) ; la régie voit tout.
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

-- La grille d'une manche : les 25 noms (dans les langues de la soirée) et les cibles révélées pour
-- tous ; les contenus et la carte noire pour la régie ; la carte noire à l'écran une fois montrée (étape « noire ») ou la
-- manche terminée.
create function public.grille_portrait_ecran(
  p_manche public.manches,
  p_pilotage public.pilotage,
  p_langues public.langue[],
  p_regie boolean
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'cartes', (
      select jsonb_agg(public.contenu_public(c.contenu, p_langues) order by c.i)
      from unnest(g.cartes) with ordinality as c(contenu, i)),
    'ids', case when p_regie then to_jsonb(g.cartes) end,
    -- Les cibles révélées : passage → position dans la grille (la carte se retourne à l'écran).
    'retournees', coalesce((
      select jsonb_object_agg(pa.id::text, array_position(g.cartes, pa.contenu_id) - 1)
      from public.passages pa
      where pa.manche_id = p_manche.id and pa.statut = 'termine'
        and array_position(g.cartes, pa.contenu_id) is not null), '{}'::jsonb),
    'noire', case
      when p_regie
        or p_manche.statut = 'terminee'
        or (p_pilotage.manche_id = p_manche.id and p_pilotage.etape = 'noire')
      then g.noire end
  )
  from public.grilles_portrait g
  where g.manche_id = p_manche.id;
$$;

-- Les votes du tour en cours : la carte de chaque équipe pour la régie, « a voté » pour l'écran.
create function public.votes_portrait_ecran(p_passage uuid, p_tour smallint, p_regie boolean)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(
    eq.numero::text, case when p_regie then to_jsonb(v.carte) else 'true'::jsonb end
  ), '{}'::jsonb)
  from public.votes_portrait v
  join public.equipes eq on eq.id = v.equipe_id
  where v.passage_id = p_passage and v.tour = p_tour;
$$;

-- Reprise de 20261118090000_avis_joueurs.sql : la grille, les votes, et pour un passage de
-- Portrait mystère non révélé, ni `contenu_id` ni `public` hors régie (ce serait la réponse).
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

-- ---------------------------------------------------------------------------
-- Relancer un jeu : reprise de 20261115100000_recommencer_manche.sql, les votes en plus
-- ---------------------------------------------------------------------------

create or replace function public.recommencer_manche(p_manche uuid, p_motif text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_manche public.manches;
  v_version timestamptz;
begin
  select * into v_manche from public.manches m where m.id = p_manche for update;
  if not found or not public.anime(v_manche.evenement_id) then
    raise exception 'manche inconnue' using errcode = 'insufficient_privilege';
  end if;
  if v_manche.statut = 'annulee' then
    raise exception 'manche annulée' using errcode = 'PT409';
  end if;
  if p_motif is null or char_length(p_motif) not between 1 and 200 then
    raise exception 'motif invalide' using errcode = 'check_violation';
  end if;

  -- Une ligne contraire par équipe : le classement retombe à ce qu'il était sans ce jeu, et une
  -- seconde relance n'annule rien deux fois (la somme est déjà nulle).
  insert into public.scores (evenement_id, equipe_id, manche_id, points, motif, saisi_par)
  select s.evenement_id, s.equipe_id, p_manche, -sum(s.points), p_motif, (select auth.uid())
  from public.scores s
  where s.manche_id = p_manche
  group by s.evenement_id, s.equipe_id
  having sum(s.points) <> 0;

  delete from public.mises_quiz mq
  using public.passages pa
  where pa.id = mq.passage_id and pa.manche_id = p_manche;

  delete from public.reponses_quiz rq
  using public.passages pa
  where pa.id = rq.passage_id and pa.manche_id = p_manche;

  delete from public.mots_surenchere mo
  using public.passages pa
  where pa.id = mo.passage_id and pa.manche_id = p_manche;

  delete from public.votes_portrait vp
  using public.passages pa
  where pa.id = vp.passage_id and pa.manche_id = p_manche;

  if v_manche.jeu = 'photo2' then
    update public.photos ph set gagnante = false
    from public.passages pa
    where pa.manche_id = p_manche
      and ph.evenement_id = v_manche.evenement_id
      and ph.theme_id = pa.contenu_id
      and ph.gagnante;
  end if;

  update public.passages pa set
    statut = 'a_venir',
    resultat = '{}'::jsonb,
    points = null,
    joueur_designe_id = null,
    commence_le = null,
    termine_le = null
  where pa.manche_id = p_manche;

  -- Le mode (quiz, Surenchère, Portrait mystère), les jetons de départ, la fin demandée et les
  -- survivants validés viennent du lancement : ils repartent avec lui.
  update public.manches m set
    statut = 'a_venir',
    options = m.options - 'mode' - 'jetons' - 'fin' - 'survivants',
    commence_le = null,
    termine_le = null
  where m.id = p_manche;

  update public.pilotage p set
    scene = 'intro',
    manche_id = p_manche,
    passage_id = null,
    etape = null,
    indices = 0,
    chrono_depart = null,
    chrono_duree_s = null,
    maj_le = clock_timestamp()
  where p.evenement_id = v_manche.evenement_id
  returning p.maj_le into v_version;

  return v_version;
end;
$$;

revoke execute on function public.grille_portrait_ecran(public.manches, public.pilotage, public.langue[], boolean)
  from public, anon;
grant execute on function public.grille_portrait_ecran(public.manches, public.pilotage, public.langue[], boolean)
  to authenticated;
revoke execute on function public.votes_portrait_ecran(uuid, smallint, boolean) from public, anon;
grant execute on function public.votes_portrait_ecran(uuid, smallint, boolean) to authenticated;
