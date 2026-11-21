-- Tournoi de Tête, épaule, gobelet (2026-11-21).
--
-- Tous les joueurs de la soirée dans un tableau à élimination directe. Jusqu'aux quarts, autant de
-- matchs en même temps qu'il y a de gobelets ; demi-finales et finale sur scène. Les perdants
-- viennent le signaler à la régie, qui seule écrit les résultats : aucun téléphone n'écrit ici.
--
-- Le tirage et le découpage en séquences sont calculés par `packages/game` (`tirerTableau`,
-- `prochaineSequence`) ; ces fonctions revérifient ce qu'elles reçoivent et l'écrivent d'un bloc.

create table public.matchs_tournoi (
  -- Une clé à soi : jamais une clé primaire faite de deux clés étrangères (règle du 2026-11-18).
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  manche_id uuid not null references public.manches (id) on delete cascade,
  tour smallint not null check (tour between 1 and 8),
  rang smallint not null check (rang between 0 and 127),
  -- Prénom et équipe recopiés : un joueur retiré de la Salle reste lisible dans le tableau.
  joueur_a uuid references public.joueurs (id) on delete set null,
  prenom_a text,
  equipe_a smallint check (equipe_a between 1 and 8),
  joueur_b uuid references public.joueurs (id) on delete set null,
  prenom_b text,
  equipe_b smallint check (equipe_b between 1 and 8),
  -- 0 pour a, 1 pour b. Un exempté (premier tour, sans b) a déjà gagné.
  gagnant smallint check (gagnant in (0, 1)),
  sequence smallint check (sequence >= 1),
  poste smallint check (poste between 1 and 32),
  constraint matchs_tournoi_place unique (manche_id, tour, rang),
  constraint matchs_tournoi_appel check ((sequence is null) = (poste is null)),
  constraint matchs_tournoi_gagnant check (
    gagnant is null
    or (gagnant = 0 and prenom_a is not null)
    or (gagnant = 1 and prenom_b is not null)
  )
);

create index matchs_tournoi_evenement on public.matchs_tournoi (evenement_id);
create index matchs_tournoi_joueur_a on public.matchs_tournoi (joueur_a, manche_id);
create index matchs_tournoi_joueur_b on public.matchs_tournoi (joueur_b, manche_id);
create index matchs_tournoi_sequence on public.matchs_tournoi (manche_id, sequence);

alter table public.matchs_tournoi enable row level security;

create policy "animateur lit les matchs de ses événements" on public.matchs_tournoi
  for select to authenticated
  using (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Le tirage : le premier tour reçu, le reste de l'arbre construit ici
-- ---------------------------------------------------------------------------

-- Le premier tour reçu, en lignes. Un identifiant mal formé est refusé par le cast (classe 22).
create function public.lignes_tableau(p_premier_tour jsonb)
returns table (rang smallint, a uuid, b uuid)
language sql
immutable
set search_path = ''
as $$
  select (x ->> 'rang')::smallint, (x ->> 'a')::uuid, (x ->> 'b')::uuid
  from jsonb_array_elements(p_premier_tour) x;
$$;

revoke execute on function public.lignes_tableau(jsonb) from public, anon, authenticated;

create function public.poser_tableau(p_manche uuid, p_premier_tour jsonb, p_gobelets integer)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_manche public.manches;
  v_cases integer;
  v_tours integer := 1;
  v_joueurs integer;
  v_valides integer;
begin
  select * into v_manche from public.manches m where m.id = p_manche for update;
  if not found or not public.anime(v_manche.evenement_id) then
    raise exception 'manche inconnue' using errcode = 'insufficient_privilege';
  end if;
  if v_manche.jeu <> 'cup' or v_manche.options ->> 'format' is distinct from 'tournoi' then
    raise exception 'pas un tournoi' using errcode = 'PT409';
  end if;
  if v_manche.statut <> 'en_cours' then
    raise exception 'tournoi non lancé' using errcode = 'PT409';
  end if;
  if exists (
    select 1 from public.matchs_tournoi t where t.manche_id = p_manche and t.sequence is not null
  ) then
    raise exception 'tableau déjà joué' using errcode = 'PT409';
  end if;
  if p_gobelets is null or p_gobelets not between 2 and 32 then
    raise exception 'gobelets invalides' using errcode = 'check_violation';
  end if;
  if jsonb_typeof(p_premier_tour) is distinct from 'array' then
    raise exception 'tableau invalide' using errcode = 'check_violation';
  end if;

  v_cases := jsonb_array_length(p_premier_tour);
  if v_cases not in (1, 2, 4, 8, 16, 32, 64, 128) then
    raise exception 'tableau invalide' using errcode = 'check_violation';
  end if;
  while (1 << (v_tours - 1)) < v_cases loop
    v_tours := v_tours + 1;
  end loop;

  -- Chaque place une fois, chaque joueur une fois, et le plus petit tableau qui les contient.
  if (select count(distinct l.rang) from public.lignes_tableau(p_premier_tour) l where l.rang between 0 and v_cases - 1)
       <> v_cases
     or exists (select 1 from public.lignes_tableau(p_premier_tour) l where l.a is null) then
    raise exception 'tableau invalide' using errcode = 'check_violation';
  end if;
  select count(*), count(distinct p.id) into v_joueurs, v_valides from (
    select l.a as id from public.lignes_tableau(p_premier_tour) l
    union all
    select l.b from public.lignes_tableau(p_premier_tour) l where l.b is not null
  ) p;
  if v_joueurs <> v_valides or v_joueurs <= v_cases or v_joueurs > v_cases * 2 then
    raise exception 'tableau invalide' using errcode = 'check_violation';
  end if;
  select count(*) into v_valides
  from public.joueurs j
  where j.evenement_id = v_manche.evenement_id
    and j.equipe_id is not null
    and j.id in (
      select l.a from public.lignes_tableau(p_premier_tour) l
      union
      select l.b from public.lignes_tableau(p_premier_tour) l where l.b is not null
    );
  if v_valides <> v_joueurs then
    raise exception 'joueur hors de la soirée' using errcode = 'check_violation';
  end if;

  delete from public.matchs_tournoi t where t.manche_id = p_manche;

  insert into public.matchs_tournoi (
    evenement_id, manche_id, tour, rang,
    joueur_a, prenom_a, equipe_a, joueur_b, prenom_b, equipe_b, gagnant
  )
  select
    v_manche.evenement_id, p_manche, 1, l.rang,
    ja.id, ja.prenom, ea.numero, jb.id, jb.prenom, eb.numero,
    case when l.b is null then 0 end
  from public.lignes_tableau(p_premier_tour) l
  join public.joueurs ja on ja.id = l.a
  join public.equipes ea on ea.id = ja.equipe_id
  left join public.joueurs jb on jb.id = l.b
  left join public.equipes eb on eb.id = jb.equipe_id;

  insert into public.matchs_tournoi (evenement_id, manche_id, tour, rang)
  select v_manche.evenement_id, p_manche, t, r
  from generate_series(2, v_tours) t
  cross join lateral generate_series(0, (v_cases >> (t - 1)) - 1) r;

  -- Les exemptés montent au deuxième tour. Deux passes : deux exemptés peuvent s'y retrouver, et
  -- un UPDATE … FROM n'applique qu'une ligne source par ligne visée.
  update public.matchs_tournoi s set
    joueur_a = e.joueur_a, prenom_a = e.prenom_a, equipe_a = e.equipe_a
  from public.matchs_tournoi e
  where e.manche_id = p_manche and e.tour = 1 and e.prenom_b is null and e.rang % 2 = 0
    and s.manche_id = p_manche and s.tour = 2 and s.rang = e.rang / 2;
  update public.matchs_tournoi s set
    joueur_b = e.joueur_a, prenom_b = e.prenom_a, equipe_b = e.equipe_a
  from public.matchs_tournoi e
  where e.manche_id = p_manche and e.tour = 1 and e.prenom_b is null and e.rang % 2 = 1
    and s.manche_id = p_manche and s.tour = 2 and s.rang = e.rang / 2;

  update public.manches m set
    options = m.options || jsonb_build_object('gobelets', p_gobelets, 'joueurs', v_joueurs)
  where m.id = p_manche;

  return v_joueurs;
end;
$$;

revoke execute on function public.poser_tableau(uuid, jsonb, integer) from public, anon;
grant execute on function public.poser_tableau(uuid, jsonb, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Appeler une séquence : les postes et l'étape du pilotage, d'un bloc
-- ---------------------------------------------------------------------------

create function public.ouvrir_sequence(
  p_manche uuid,
  p_version timestamptz,
  p_numero integer,
  p_matchs uuid[],
  p_gobelets integer,
  p_pilotage jsonb
) returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_manche public.manches;
  v_tour smallint;
begin
  select * into v_manche from public.manches m where m.id = p_manche for update;
  if not found or not public.anime(v_manche.evenement_id) then
    raise exception 'manche inconnue' using errcode = 'insufficient_privilege';
  end if;
  if p_gobelets is null or p_gobelets not between 2 and 32 then
    raise exception 'gobelets invalides' using errcode = 'check_violation';
  end if;
  if coalesce(cardinality(p_matchs), 0) not between 1 and p_gobelets then
    raise exception 'séquence invalide' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.matchs_tournoi t
    where t.manche_id = p_manche and t.sequence is not null and t.gagnant is null
  ) then
    raise exception 'résultats manquants' using errcode = 'PT409';
  end if;
  -- Un double appui arrive avec un numéro déjà pris.
  if p_numero <> 1 + coalesce((
    select max(t.sequence) from public.matchs_tournoi t where t.manche_id = p_manche
  ), 0) then
    raise exception 'pilotage périmé' using errcode = 'PT409';
  end if;

  select min(t.tour) into v_tour
  from public.matchs_tournoi t
  where t.manche_id = p_manche and t.gagnant is null;

  if (
    select count(*) from public.matchs_tournoi t
    where t.manche_id = p_manche
      and t.id = any (p_matchs)
      and t.tour = v_tour
      and t.gagnant is null
      and t.sequence is null
      and t.prenom_a is not null
      and t.prenom_b is not null
  ) <> cardinality(p_matchs) or cardinality(p_matchs) <> (
    select count(distinct x) from unnest(p_matchs) x
  ) then
    raise exception 'séquence invalide' using errcode = 'check_violation';
  end if;

  update public.matchs_tournoi t set sequence = p_numero, poste = o.poste
  from unnest(p_matchs) with ordinality as o(id, poste)
  where t.id = o.id;

  update public.manches m set options = m.options || jsonb_build_object('gobelets', p_gobelets)
  where m.id = p_manche;

  return public.enregistrer_etape(v_manche.evenement_id, p_version, p_pilotage);
end;
$$;

revoke execute on function public.ouvrir_sequence(uuid, timestamptz, integer, uuid[], integer, jsonb)
  from public, anon;
grant execute on function public.ouvrir_sequence(uuid, timestamptz, integer, uuid[], integer, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Un résultat, donné à la régie par le perdant ; `null` l'annule
-- ---------------------------------------------------------------------------
-- Comme `regler_son`, ne touche pas à `pilotage.maj_le` : seize résultats à la suite ne rendent
-- pas « périmée » la touche suivante de l'animateur.

create function public.resultat_match(p_match uuid, p_gagnant integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_manche uuid;
  v public.matchs_tournoi;
  v_joueur uuid;
  v_prenom text;
  v_equipe smallint;
begin
  select t.manche_id into v_manche from public.matchs_tournoi t where t.id = p_match;
  if not found then
    raise exception 'match inconnu' using errcode = 'insufficient_privilege';
  end if;
  -- Partagé : plusieurs résultats passent ensemble, l'appel d'une séquence attend qu'ils finissent.
  perform 1 from public.manches m where m.id = v_manche for share;
  select * into v from public.matchs_tournoi t where t.id = p_match for update;
  if not public.anime(v.evenement_id) then
    raise exception 'match inconnu' using errcode = 'insufficient_privilege';
  end if;
  if p_gagnant is not null and p_gagnant not in (0, 1) then
    raise exception 'gagnant invalide' using errcode = 'check_violation';
  end if;
  if v.sequence is null or v.prenom_a is null or v.prenom_b is null then
    raise exception 'match non appelé' using errcode = 'PT409';
  end if;
  if exists (
    select 1 from public.matchs_tournoi t
    where t.manche_id = v.manche_id and t.sequence > v.sequence
  ) then
    raise exception 'séquence close' using errcode = 'PT409';
  end if;
  if not exists (
    select 1 from public.pilotage pi
    where pi.evenement_id = v.evenement_id
      and pi.manche_id = v.manche_id
      and pi.scene = 'jeu'
      and pi.etape in ('jeu', 'resultats')
  ) then
    raise exception 'séquence fermée' using errcode = 'PT409';
  end if;

  update public.matchs_tournoi t set gagnant = p_gagnant where t.id = v.id;

  if p_gagnant = 0 then
    v_joueur := v.joueur_a; v_prenom := v.prenom_a; v_equipe := v.equipe_a;
  elsif p_gagnant = 1 then
    v_joueur := v.joueur_b; v_prenom := v.prenom_b; v_equipe := v.equipe_b;
  end if;

  -- Le gagnant monte ; une annulation libère sa place.
  if v.rang % 2 = 0 then
    update public.matchs_tournoi s set joueur_a = v_joueur, prenom_a = v_prenom, equipe_a = v_equipe
    where s.manche_id = v.manche_id and s.tour = v.tour + 1 and s.rang = v.rang / 2;
  else
    update public.matchs_tournoi s set joueur_b = v_joueur, prenom_b = v_prenom, equipe_b = v_equipe
    where s.manche_id = v.manche_id and s.tour = v.tour + 1 and s.rang = v.rang / 2;
  end if;
end;
$$;

revoke execute on function public.resultat_match(uuid, integer) from public, anon;
grant execute on function public.resultat_match(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Ce que lisent l'écran, la régie et chaque téléphone
-- ---------------------------------------------------------------------------

create function public.duelliste_json(p_joueur uuid, p_prenom text, p_equipe smallint)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when p_prenom is null then null else jsonb_build_object(
    'joueur_id', p_joueur, 'prenom', p_prenom, 'equipe', p_equipe
  ) end;
$$;

-- Security definer avec un seul contrôle d'`anime()` : la RLS le rappellerait à chaque ligne.
create function public.tournoi_ecran(p_evenement uuid, p_pilotage public.pilotage)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ouverte as (
    select m.id, m.options
    from public.manches m
    where m.id = p_pilotage.manche_id
      and m.evenement_id = p_evenement
      and m.jeu = 'cup'
      and m.options ->> 'format' = 'tournoi'
      and public.anime(p_evenement)
  ), bornes as (
    select
      o.id,
      o.options,
      (select max(t.tour) from public.matchs_tournoi t where t.manche_id = o.id) as tours,
      (select max(t.sequence) from public.matchs_tournoi t where t.manche_id = o.id) as numero
    from ouverte o
  )
  select jsonb_build_object(
    'gobelets', b.options -> 'gobelets',
    'joueurs', b.options -> 'joueurs',
    'tours', b.tours,
    'sequence', b.numero,
    'tour', (
      select t.tour from public.matchs_tournoi t
      where t.manche_id = b.id and t.sequence = b.numero limit 1
    ),
    'reste', exists (
      select 1 from public.matchs_tournoi t
      where t.manche_id = b.id and t.gagnant is null and t.sequence is null
    ),
    'en_lice', (b.options ->> 'joueurs')::integer - (
      select count(*) from public.matchs_tournoi t
      where t.manche_id = b.id and t.gagnant is not null and t.prenom_b is not null
    ),
    'matchs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'tour', t.tour, 'rang', t.rang, 'sequence', t.sequence, 'poste', t.poste,
        'a', public.duelliste_json(t.joueur_a, t.prenom_a, t.equipe_a),
        'b', public.duelliste_json(t.joueur_b, t.prenom_b, t.equipe_b),
        'gagnant', t.gagnant
      ) order by t.poste)
      from public.matchs_tournoi t
      where t.manche_id = b.id and t.sequence = b.numero
    ), '[]'::jsonb),
    -- Quarts, demi-finales et finale : ce que l'écran dessine en tableau.
    'tableau', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'tour', t.tour, 'rang', t.rang, 'sequence', t.sequence, 'poste', t.poste,
        'a', public.duelliste_json(t.joueur_a, t.prenom_a, t.equipe_a),
        'b', public.duelliste_json(t.joueur_b, t.prenom_b, t.equipe_b),
        'gagnant', t.gagnant
      ) order by t.tour, t.rang)
      from public.matchs_tournoi t
      where t.manche_id = b.id and t.tour >= b.tours - 2
    ), '[]'::jsonb)
  )
  from bornes b;
$$;

revoke execute on function public.tournoi_ecran(uuid, public.pilotage) from public, anon;
grant execute on function public.tournoi_ecran(uuid, public.pilotage) to authenticated;

-- Son seul match, par les index du joueur : une relecture ne parcourt pas le tableau (règle du
-- 2026-10-31).
create function public.tournoi_du_joueur(p_joueur public.joueurs)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ouverte as (
    select m.id, pi.etape
    from public.pilotage pi
    join public.manches m on m.id = pi.manche_id
    where pi.evenement_id = p_joueur.evenement_id
      and pi.scene = 'jeu'
      and m.jeu = 'cup'
      and m.options ->> 'format' = 'tournoi'
  ), siens as (
    select t.*, true as cote_a
    from public.matchs_tournoi t join ouverte o on o.id = t.manche_id
    where t.joueur_a = p_joueur.id
    union all
    select t.*, false
    from public.matchs_tournoi t join ouverte o on o.id = t.manche_id
    where t.joueur_b = p_joueur.id
  ), dernier as (
    select * from siens order by tour desc limit 1
  )
  select jsonb_build_object(
    'etape', o.etape,
    'tire', exists (select 1 from public.matchs_tournoi t where t.manche_id = o.id),
    'tours', (select max(t.tour) from public.matchs_tournoi t where t.manche_id = o.id),
    'sequence', (select max(t.sequence) from public.matchs_tournoi t where t.manche_id = o.id),
    'exempte', exists (select 1 from siens s where s.tour = 1 and s.prenom_b is null),
    'match', (
      select jsonb_build_object(
        'tour', d.tour,
        'sequence', d.sequence,
        'poste', d.poste,
        'adversaire', case when d.cote_a
          then public.duelliste_json(d.joueur_b, d.prenom_b, d.equipe_b)
          else public.duelliste_json(d.joueur_a, d.prenom_a, d.equipe_a) end,
        'gagne', case when d.gagnant is null then null
          else (d.gagnant = 0) = d.cote_a end
      )
      from dernier d
    )
  )
  from ouverte o;
$$;

revoke execute on function public.tournoi_du_joueur(public.joueurs) from public, anon, authenticated;
grant execute on function public.tournoi_du_joueur(public.joueurs) to service_role;

-- ---------------------------------------------------------------------------
-- etat_joueur : reprise de 20261120100000_cartes_joueurs.sql, le tournoi en plus
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
      ),
      -- Ses coéquipiers (audit du 2026-11-18) : son équipe seulement (règle du 2026-10-31).
      'membres', coalesce((
        select jsonb_agg(jsonb_build_object('prenom', m.prenom, 'capitaine', m.capitaine)
          order by m.capitaine desc, m.prenom)
        from public.joueurs m where m.equipe_id = eq.id
      ), '[]'::jsonb)
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
    -- Tournoi du gobelet (2026-11-21) : son seul match.
    'tournoi', public.tournoi_du_joueur(j),
    'photos', public.photos_du_joueur(j),
    -- Sa carte « Faisons connaissance » (2026-11-18), et si elle a déjà été tirée.
    'carte', (
      select jsonb_build_object(
        'age', c.age,
        'metier', c.metier,
        'anecdote', c.anecdote,
        'accord', c.accord,
        'tiree', exists (select 1 from public.tirages_cartes t where t.joueur_id = j.id)
      )
      from public.cartes_joueurs c
      where c.joueur_id = j.id
    ),
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
-- etat_ecran : reprise de 20261122100000_cinemime.sql, le tournoi en plus
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
    -- Tournoi du gobelet (2026-11-21) : la séquence en cours et la fin du tableau.
    'tournoi', public.tournoi_ecran(e.id, pi),
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

-- ---------------------------------------------------------------------------
-- Relancer un jeu : reprise de 20261119100000_portrait_mystere.sql, les matchs en plus
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

  delete from public.matchs_tournoi t where t.manche_id = p_manche;

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
    options = m.options - 'mode' - 'jetons' - 'fin' - 'survivants' - 'joueurs',
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
