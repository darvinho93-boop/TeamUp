-- Quiz en mode jetons (2026-10-18).
--
-- Chaque équipe, réunie, confie la mise à son capitaine : à chaque question, il répartit tous les
-- jetons de l'équipe sur les quatre réponses, depuis son téléphone ; ceux posés sur une mauvaise
-- réponse sont perdus. Toutes les équipes partent avec l'effectif de la plus grande
-- (`manches.options.jetons`, posé au lancement par la régie). En fin de manche, les jetons
-- restants se comptent comme des survivants (× 100). Chrono écoulé sans validation : l'équipe
-- est figée, la régie la débloque. Les mises sont publiques : l'écran les montre en direct.
--
-- Écart assumé à la spec v3, qui ne prévoit que les modes croix et téléphone.

-- ---------------------------------------------------------------------------
-- Les mises
-- ---------------------------------------------------------------------------

create table public.mises_quiz (
  passage_id uuid not null,
  -- Dénormalisé, comme pour les réponses : la policy travaille par événement.
  evenement_id uuid not null,
  equipe_id uuid not null references public.equipes (id) on delete cascade,
  -- Les jetons posés sur A, B, C et D.
  repartition smallint[] not null default array[0, 0, 0, 0]::smallint[]
    check (array_length(repartition, 1) = 4 and 0 <= all (repartition)),
  valide boolean not null default false,
  -- Débloquée par la régie : la mise reste ouverte après le chrono.
  debloquee boolean not null default false,
  maj_le timestamptz not null default now(),
  primary key (passage_id, equipe_id),
  foreign key (passage_id, evenement_id)
    references public.passages (id, evenement_id) on delete cascade
);

create index mises_quiz_evenement_idx on public.mises_quiz (evenement_id);

alter table public.mises_quiz enable row level security;

-- Lecture pour la régie et l'écran ; aucune écriture directe : `miser_quiz` (le capitaine, par
-- le serveur) et `debloquer_mise` (la régie) seulement.
create policy "animateur lit les mises de ses événements" on public.mises_quiz
  for select to authenticated
  using (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Les jetons de chaque équipe
-- ---------------------------------------------------------------------------

-- Pour chaque équipe : les jetons de départ, puis, question révélée après question révélée (les
-- annulées ne comptent pas), ceux posés sur la bonne réponse. Une équipe sans mise sur une
-- question révélée perd tout. `restants` est aussi ce qu'elle peut poser sur la question ouverte.
create function public.jetons_quiz(p_manche uuid)
returns table (equipe_id uuid, numero smallint, depart integer, restants integer)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_manche public.manches;
  v_equipe public.equipes;
  v_passage record;
  v_jetons integer;
begin
  select * into v_manche from public.manches m where m.id = p_manche;
  if not found then
    return;
  end if;
  for v_equipe in
    select * from public.equipes eq where eq.evenement_id = v_manche.evenement_id order by eq.numero
  loop
    v_jetons := coalesce((v_manche.options ->> 'jetons')::integer, 0);
    for v_passage in
      select pa.id, (
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
      order by pa.ordre
    loop
      v_jetons := least(v_jetons, coalesce((
        select mq.repartition[v_passage.bonne + 1]
        from public.mises_quiz mq
        where mq.passage_id = v_passage.id and mq.equipe_id = v_equipe.id
      ), 0));
    end loop;
    equipe_id := v_equipe.id;
    numero := v_equipe.numero;
    depart := coalesce((v_manche.options ->> 'jetons')::integer, 0);
    restants := v_jetons;
    return next;
  end loop;
end;
$$;

revoke execute on function public.jetons_quiz(uuid) from public, anon;
grant execute on function public.jetons_quiz(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Le capitaine mise
-- ---------------------------------------------------------------------------

-- La mise de l'équipe du capitaine de ce jeton, sur la question ouverte : enregistrée à chaque
-- appel, validée quand `p_valider`. Refus, dans cet ordre : session inconnue, question fermée
-- (pas le mode jetons, pas de question en cours), pas capitaine, déjà validée, temps écoulé
-- (heure de la base, une seconde de grâce ; sauf équipe débloquée par la régie), mise invalide
-- (quatre entiers positifs, pas plus que les jetons de l'équipe, tous posés pour valider).
create function public.miser_quiz(p_jeton_hash text, p_repartition smallint[], p_valider boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_pilotage public.pilotage;
  v_manche public.manches;
  v_mise public.mises_quiz;
  v_dispo integer;
  v_total integer;
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;

  select * into v_pilotage from public.pilotage pi where pi.evenement_id = v_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  if v_manche.jeu is distinct from 'qcm2'
    or v_manche.options ->> 'mode' is distinct from 'jetons'
    or v_pilotage.scene <> 'jeu'
    or v_pilotage.etape is distinct from 'question'
    or v_pilotage.passage_id is null
    or v_pilotage.chrono_depart is null
  then
    raise exception 'question fermée' using errcode = 'check_violation';
  end if;

  if not v_joueur.capitaine or v_joueur.equipe_id is null then
    raise exception 'pas capitaine' using errcode = 'insufficient_privilege';
  end if;

  select * into v_mise from public.mises_quiz mq
  where mq.passage_id = v_pilotage.passage_id and mq.equipe_id = v_joueur.equipe_id
  for update;
  if v_mise.valide then
    raise exception 'déjà validée' using errcode = 'check_violation';
  end if;

  if clock_timestamp() > v_pilotage.chrono_depart
      + make_interval(secs => v_pilotage.chrono_duree_s + 1)
    and not coalesce(v_mise.debloquee, false)
  then
    raise exception 'temps écoulé' using errcode = 'check_violation';
  end if;

  select j.restants into v_dispo from public.jetons_quiz(v_manche.id) j
  where j.equipe_id = v_joueur.equipe_id;
  select sum(n) into v_total from unnest(p_repartition) as n;
  if coalesce(array_length(p_repartition, 1), 0) <> 4
    or exists (select 1 from unnest(p_repartition) as n where n is null or n < 0)
    or v_total > coalesce(v_dispo, 0)
    or (p_valider and v_total <> coalesce(v_dispo, 0))
  then
    raise exception 'mise invalide' using errcode = 'check_violation';
  end if;

  insert into public.mises_quiz (passage_id, evenement_id, equipe_id, repartition, valide, maj_le)
  values (v_pilotage.passage_id, v_joueur.evenement_id, v_joueur.equipe_id, p_repartition,
    p_valider, now())
  on conflict (passage_id, equipe_id) do update
    set repartition = excluded.repartition, valide = excluded.valide, maj_le = now();

  return jsonb_build_object(
    'repartition', to_jsonb(p_repartition), 'valide', p_valider, 'dispo', v_dispo
  );
end;
$$;

revoke execute on function public.miser_quiz(text, smallint[], boolean)
  from public, anon, authenticated;
grant execute on function public.miser_quiz(text, smallint[], boolean) to service_role;

-- La régie rouvre la mise d'une équipe figée (chrono écoulé sans validation, connexion perdue) :
-- son capitaine peut de nouveau poser et valider. Sous la session de l'animateur de la soirée.
create function public.debloquer_mise(p_passage uuid, p_equipe uuid) returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_passage public.passages;
begin
  select * into v_passage from public.passages pa where pa.id = p_passage;
  if not found or not public.anime(v_passage.evenement_id) then
    raise exception 'passage inconnu' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.equipes eq
    where eq.id = p_equipe and eq.evenement_id = v_passage.evenement_id
  ) then
    raise exception 'équipe inconnue' using errcode = 'check_violation';
  end if;

  insert into public.mises_quiz (passage_id, evenement_id, equipe_id, debloquee)
  values (p_passage, v_passage.evenement_id, p_equipe, true)
  on conflict (passage_id, equipe_id) do update set debloquee = true, maj_le = now();
end;
$$;

revoke execute on function public.debloquer_mise(uuid, uuid) from public, anon;
grant execute on function public.debloquer_mise(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ce que voit un téléphone en mode jetons
-- ---------------------------------------------------------------------------

-- La question dans la langue du joueur, la mise de son équipe (lecture seule pour les
-- coéquipiers), les jetons à poser, l'état figé, et, une fois révélée, la bonne réponse et les
-- jetons qui restent. Les mises sont publiques : rien de secret ici, hors la bonne réponse.
create function public.quiz_jetons_du_joueur(
  p_joueur public.joueurs,
  p_pilotage public.pilotage,
  p_manche public.manches
) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_passage public.passages;
  v_mise public.mises_quiz;
  v_question jsonb;
  v_revelee boolean;
  v_restants integer;
  v_ecoule boolean;
begin
  select * into v_passage from public.passages pa where pa.id = p_pilotage.passage_id;
  select * into v_mise from public.mises_quiz mq
  where mq.passage_id = p_pilotage.passage_id and mq.equipe_id = p_joueur.equipe_id;
  select j.restants into v_restants from public.jetons_quiz(p_manche.id) j
  where j.equipe_id = p_joueur.equipe_id;

  v_revelee := p_pilotage.etape = 'reponse' and v_passage.statut = 'termine';
  v_ecoule := coalesce(clock_timestamp() > p_pilotage.chrono_depart
    + make_interval(secs => p_pilotage.chrono_duree_s + 1), false);
  if p_pilotage.etape in ('question', 'reponse') then
    select t.valeur into v_question
    from public.contenus_traductions t
    where t.contenu_id = v_passage.contenu_id
    order by (t.langue = p_joueur.langue) desc, (t.langue = 'fr') desc
    limit 1;
  end if;

  return jsonb_build_object(
    'mode', 'jetons',
    'serveur_ms', floor(extract(epoch from clock_timestamp()) * 1000),
    'etape', p_pilotage.etape,
    'passage_id', p_pilotage.passage_id,
    'numero', v_passage.ordre,
    'total', (select count(*) from public.passages pa where pa.manche_id = p_manche.id),
    'chrono_depart_ms', floor(extract(epoch from p_pilotage.chrono_depart) * 1000),
    'chrono_duree_s', p_pilotage.chrono_duree_s,
    'question', v_question,
    'capitaine', p_joueur.capitaine and p_joueur.equipe_id is not null,
    'equipe', p_joueur.equipe_id is not null,
    -- Avant la révélation, ce que l'équipe peut poser ; après, ce qui lui reste.
    'jetons', coalesce(v_restants, 0),
    'repartition', coalesce(to_jsonb(v_mise.repartition), '[0, 0, 0, 0]'::jsonb),
    'valide', coalesce(v_mise.valide, false),
    -- Une équipe sans jeton n'a rien à poser : jamais figée.
    'fige', p_pilotage.etape = 'question' and v_ecoule and coalesce(v_restants, 0) > 0
      and not coalesce(v_mise.valide, false) and not coalesce(v_mise.debloquee, false),
    'bonne', case when v_revelee then (
      select (s.valeur ->> 'bonne')::smallint
      from public.contenus_secrets s
      where s.contenu_id = v_passage.contenu_id
      order by (s.langue = 'fr') desc
      limit 1
    ) end
  );
end;
$$;

revoke execute on function
  public.quiz_jetons_du_joueur(public.joueurs, public.pilotage, public.manches)
  from public, anon, authenticated;
grant execute on function
  public.quiz_jetons_du_joueur(public.joueurs, public.pilotage, public.manches)
  to service_role;

-- Reprise de 20260925090000_quiz_et_mime.sql : le mode jetons passe la main à la fonction
-- ci-dessus ; le mode téléphone gagne la clé `mode`. Les droits sont conservés.
create or replace function public.quiz_du_joueur(p_joueur public.joueurs) returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_pilotage public.pilotage;
  v_manche public.manches;
  v_passage public.passages;
  v_elimine boolean;
  v_participant boolean;
  v_question jsonb;
  v_revelee boolean;
begin
  select * into v_pilotage from public.pilotage pi where pi.evenement_id = p_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;
  if v_manche.jeu is distinct from 'qcm2'
    or coalesce(v_manche.options ->> 'mode', 'croix') not in ('telephone', 'jetons')
    or v_pilotage.scene <> 'jeu'
  then
    return null;
  end if;

  if v_manche.options ->> 'mode' = 'jetons' then
    return public.quiz_jetons_du_joueur(p_joueur, v_pilotage, v_manche);
  end if;

  select * into v_passage from public.passages pa where pa.id = v_pilotage.passage_id;
  select qj.elimine into v_elimine from public.quiz_joueurs(v_manche.id) qj
  where qj.joueur_id = p_joueur.id;
  v_participant := found;

  v_revelee := v_pilotage.etape = 'reponse' and v_passage.statut = 'termine';
  if v_pilotage.etape in ('question', 'reponse') then
    select t.valeur into v_question
    from public.contenus_traductions t
    where t.contenu_id = v_passage.contenu_id
    order by (t.langue = p_joueur.langue) desc, (t.langue = 'fr') desc
    limit 1;
  end if;

  return jsonb_build_object(
    'mode', 'telephone',
    'serveur_ms', floor(extract(epoch from clock_timestamp()) * 1000),
    'etape', v_pilotage.etape,
    'passage_id', v_pilotage.passage_id,
    'numero', v_passage.ordre,
    'total', (select count(*) from public.passages pa where pa.manche_id = v_manche.id),
    'chrono_depart_ms', floor(extract(epoch from v_pilotage.chrono_depart) * 1000),
    'chrono_duree_s', v_pilotage.chrono_duree_s,
    'question', v_question,
    'ma_reponse', (
      select r.choix from public.reponses_quiz r
      where r.passage_id = v_pilotage.passage_id and r.joueur_id = p_joueur.id
    ),
    'bonne', case when v_revelee then (
      select (s.valeur ->> 'bonne')::smallint
      from public.contenus_secrets s
      where s.contenu_id = v_passage.contenu_id
      order by (s.langue = 'fr') desc
      limit 1
    ) end,
    'participant', v_participant,
    'elimine', coalesce(v_elimine, false)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- L'écran et la régie : jetons et mises en direct
-- ---------------------------------------------------------------------------

-- Reprise de 20261017121000_logo_de_la_soiree.sql, avec `manche.jetons`, `passage.mises` et
-- `equipe.capitaine_connecte`.
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
