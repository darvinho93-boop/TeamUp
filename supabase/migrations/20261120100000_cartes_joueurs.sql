-- Cartes « Faisons connaissance » (2026-11-18, audit UX du même jour).
--
-- Un joueur remplit, s'il le veut, une carte : son âge, son métier, une anecdote, chacun
-- facultatif, et l'accord d'affichage (décoché par défaut). Après un jeu, la régie tire au sort
-- la carte d'un membre de l'équipe qu'elle célèbre ; le grand écran la présente. Le tirage est
-- gardé : un rechargement ou un second écran ne retire jamais au sort. Les cartes sont effacées
-- le lendemain de la soirée (`purgerCartesExpirees`, tâche quotidienne de l'app).
--
-- Écart assumé à « joueurs anonymes, prénom seul » : la carte est facultative, publique
-- seulement avec accord, et effacée le lendemain.

-- ---------------------------------------------------------------------------
-- Les cartes
-- ---------------------------------------------------------------------------

create table public.cartes_joueurs (
  joueur_id uuid primary key references public.joueurs (id) on delete cascade,
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  age smallint check (age between 10 and 110),
  metier text check (metier is null or char_length(metier) between 1 and 60),
  anecdote text check (anecdote is null or char_length(anecdote) between 1 and 120),
  accord boolean not null default false,
  -- Écartée par la régie : plus jamais tirée (contenu à ne pas projeter).
  ecartee boolean not null default false,
  maj_le timestamptz not null default clock_timestamp(),
  constraint cartes_joueurs_non_vide check (
    age is not null or metier is not null or anecdote is not null
  )
);

create index cartes_joueurs_evenement_idx on public.cartes_joueurs (evenement_id);

alter table public.cartes_joueurs enable row level security;

create policy "animateur lit les cartes de ses événements" on public.cartes_joueurs
  for select to authenticated
  using (public.anime(evenement_id));

-- Aucune écriture directe : `enregistrer_carte` (rôle de service) et `ecarter_carte` (régie).
revoke insert, update, delete on public.cartes_joueurs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Les tirages
-- ---------------------------------------------------------------------------

-- Une clé `id` seule : jamais une clé primaire faite de deux clés étrangères (PostgREST en
-- ferait une table de jonction, vu le 2026-11-18 avec votes_portrait).
create table public.tirages_cartes (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  manche_id uuid references public.manches (id) on delete set null,
  equipe_id uuid not null references public.equipes (id) on delete cascade,
  -- Nul : aucune carte n'était disponible, l'équipe est célébrée seule.
  joueur_id uuid references public.joueurs (id) on delete set null,
  cree_le timestamptz not null default clock_timestamp()
);

create index tirages_cartes_evenement_idx on public.tirages_cartes (evenement_id, cree_le desc);
create index tirages_cartes_joueur_idx on public.tirages_cartes (joueur_id);

alter table public.tirages_cartes enable row level security;

create policy "animateur lit les tirages de ses événements" on public.tirages_cartes
  for select to authenticated
  using (public.anime(evenement_id));

revoke insert, update, delete on public.tirages_cartes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Le joueur écrit sa carte
-- ---------------------------------------------------------------------------

-- Tous les champs vides : la carte est supprimée. Textes nettoyés comme ceux de l'avis.
create function public.enregistrer_carte(
  p_jeton_hash text,
  p_age integer,
  p_metier text,
  p_anecdote text,
  p_accord boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_statut public.statut_evenement;
  v_metier text := public.nettoyer_avis(p_metier, 60, false);
  v_anecdote text := public.nettoyer_avis(p_anecdote, 120, false);
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash for update;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;

  select e.statut into v_statut from public.evenements e where e.id = v_joueur.evenement_id;
  if v_statut = 'termine' then
    raise exception 'partie terminée' using errcode = 'PT409';
  end if;

  -- nettoyer_avis rend nul un texte trop long, une chaîne vide un texte vide.
  if (p_metier is not null and v_metier is null)
    or (p_anecdote is not null and v_anecdote is null)
    or (p_age is not null and p_age not between 10 and 110) then
    raise exception 'carte invalide' using errcode = 'check_violation';
  end if;
  v_metier := nullif(v_metier, '');
  v_anecdote := nullif(v_anecdote, '');

  if p_age is null and v_metier is null and v_anecdote is null then
    delete from public.cartes_joueurs c where c.joueur_id = v_joueur.id;
  else
    insert into public.cartes_joueurs as c
      (joueur_id, evenement_id, age, metier, anecdote, accord)
    values (
      v_joueur.id, v_joueur.evenement_id, p_age::smallint, v_metier, v_anecdote,
      coalesce(p_accord, false)
    )
    on conflict (joueur_id) do update set
      age = excluded.age,
      metier = excluded.metier,
      anecdote = excluded.anecdote,
      accord = excluded.accord,
      maj_le = clock_timestamp();
  end if;

  return jsonb_build_object('evenement_id', v_joueur.evenement_id);
end;
$$;

revoke execute on function public.enregistrer_carte(text, integer, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.enregistrer_carte(text, integer, text, text, boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- La régie tire et écarte
-- ---------------------------------------------------------------------------

-- Un membre de l'équipe dont la carte est autorisée et non écartée ; d'abord ceux qui n'ont
-- jamais été tirés, le dernier tiré en dernier (« Autre carte »), puis au hasard. Le tirage est
-- enregistré, même sans carte (joueur nul) : l'écran célèbre alors l'équipe seule.
create function public.tirer_carte(p_evenement uuid, p_manche uuid, p_equipe uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dernier uuid;
  v_joueur uuid;
  v_tirage public.tirages_cartes;
begin
  if not public.anime(p_evenement) then
    raise exception 'interdit' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.equipes eq where eq.id = p_equipe and eq.evenement_id = p_evenement
  ) or (p_manche is not null and not exists (
    select 1 from public.manches m where m.id = p_manche and m.evenement_id = p_evenement
  )) then
    raise exception 'équipe ou jeu inconnu' using errcode = 'no_data_found';
  end if;

  select t.joueur_id into v_dernier
  from public.tirages_cartes t
  where t.evenement_id = p_evenement
  order by t.cree_le desc
  limit 1;

  select c.joueur_id into v_joueur
  from public.cartes_joueurs c
  join public.joueurs j on j.id = c.joueur_id
  where j.equipe_id = p_equipe and c.accord and not c.ecartee
  order by
    exists (select 1 from public.tirages_cartes t where t.joueur_id = c.joueur_id),
    c.joueur_id is not distinct from v_dernier,
    random()
  limit 1;

  insert into public.tirages_cartes (evenement_id, manche_id, equipe_id, joueur_id)
  values (p_evenement, p_manche, p_equipe, v_joueur)
  returning * into v_tirage;

  return jsonb_build_object('id', v_tirage.id, 'joueur_id', v_tirage.joueur_id);
end;
$$;

revoke execute on function public.tirer_carte(uuid, uuid, uuid) from public, anon;
grant execute on function public.tirer_carte(uuid, uuid, uuid) to authenticated;

create function public.ecarter_carte(p_joueur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evenement uuid;
begin
  select c.evenement_id into v_evenement from public.cartes_joueurs c where c.joueur_id = p_joueur;
  if v_evenement is null or not public.anime(v_evenement) then
    raise exception 'interdit' using errcode = 'insufficient_privilege';
  end if;
  update public.cartes_joueurs set ecartee = true where joueur_id = p_joueur;
end;
$$;

revoke execute on function public.ecarter_carte(uuid) from public, anon;
grant execute on function public.ecarter_carte(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ce que voient l'écran et la régie
-- ---------------------------------------------------------------------------

-- Le dernier tirage de la soirée. Hors régie, seulement à la scène `connaissance` ; la carte
-- n'est rendue que si elle est toujours autorisée et non écartée au moment de l'afficher.
create function public.connaissance_ecran(
  p_evenement uuid,
  p_pilotage public.pilotage,
  p_regie boolean
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when not p_regie and p_pilotage.scene is distinct from 'connaissance' then null
    else (
      select jsonb_build_object(
        'tirage_id', t.id,
        'manche_id', t.manche_id,
        'jeu', m.jeu,
        'equipe', jsonb_build_object('id', eq.id, 'numero', eq.numero, 'nom', eq.nom),
        'points', (
          select coalesce(sum(s.points), 0)::integer from public.scores s
          where s.equipe_id = eq.id and s.manche_id = t.manche_id
        ),
        'carte', (
          select jsonb_build_object(
            'joueur_id', j.id, 'prenom', j.prenom,
            'age', c.age, 'metier', c.metier, 'anecdote', c.anecdote
          )
          from public.cartes_joueurs c
          join public.joueurs j on j.id = c.joueur_id
          where c.joueur_id = t.joueur_id and c.accord and not c.ecartee
        ),
        'membres', coalesce((
          select jsonb_agg(jsonb_build_object('prenom', j.prenom, 'capitaine', j.capitaine)
            order by j.capitaine desc, j.prenom)
          from public.joueurs j
          where j.equipe_id = eq.id and j.id is distinct from t.joueur_id
        ), '[]'::jsonb)
      )
      from public.tirages_cartes t
      join public.equipes eq on eq.id = t.equipe_id
      left join public.manches m on m.id = t.manche_id
      where t.evenement_id = p_evenement
      order by t.cree_le desc
      limit 1
    )
  end;
$$;

-- La régie compte les cartes prêtes à être tirées (autorisées, non écartées).
create function public.cartes_pretes(p_evenement uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer from public.cartes_joueurs c
  where c.evenement_id = p_evenement and c.accord and not c.ecartee;
$$;

-- ---------------------------------------------------------------------------
-- etat_joueur et etat_ecran : reprises de 20261119100000_portrait_mystere.sql, complétées
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
