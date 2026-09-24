-- Quiz et Mime (lot 7).
--
-- Le mime ne demande rien à la base de plus qu'au lot 6 : le mot se montre à J1 sur l'écran de
-- régie (spec v3, jeu 04), la salle ne le voit qu'au verdict. Seule la règle de `secret_visible`
-- change.
--
-- Le quiz en mode téléphone est le seul jeu où les joueurs écrivent pendant une manche. Ils ne
-- passent toujours que par une fonction (`repondre_quiz`, rôle de service), qui refuse tout ce
-- qui n'est pas une première réponse, d'un participant encore en jeu, à la question ouverte.
-- Les survivants se calculent ici, à partir des réponses : l'app n'a rien à compter.

-- ---------------------------------------------------------------------------
-- Réponses du quiz en mode téléphone
-- ---------------------------------------------------------------------------

create table public.reponses_quiz (
  passage_id uuid not null,
  -- Dénormalisé, comme pour les passages : la policy et le filtre temps réel travaillent par événement.
  evenement_id uuid not null,
  joueur_id uuid not null references public.joueurs (id) on delete cascade,
  choix smallint not null check (choix between 0 and 3),
  repondu_le timestamptz not null default now(),
  primary key (passage_id, joueur_id),
  foreign key (passage_id, evenement_id)
    references public.passages (id, evenement_id) on delete cascade
);

create index reponses_quiz_evenement_idx on public.reponses_quiz (evenement_id);

alter table public.reponses_quiz enable row level security;

-- Lecture pour la régie ; aucune écriture directe, pour personne : seul `repondre_quiz` insère.
create policy "animateur lit les réponses de ses événements" on public.reponses_quiz
  for select to authenticated
  using (public.anime(evenement_id));

-- ---------------------------------------------------------------------------
-- Qui est encore en jeu
-- ---------------------------------------------------------------------------

-- Les participants d'une manche de quiz, et s'ils sont éliminés.
-- Participant : dans une équipe, arrivé avant l'ouverture de la première question (les suivants
-- regardent). Éliminé : une question comptée sans sa bonne réponse, qu'il ait répondu faux ou pas
-- du tout. Comptée : révélée (passage terminé) et pas annulée.
create function public.quiz_joueurs(p_manche uuid)
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
    and (debut.le is null or j.rejoint_le <= debut.le);
$$;

-- Survivants par numéro d'équipe, toutes les équipes présentes : { "1": 4, "2": 0, … }.
-- La forme d'entrée de `scoreQuiz`, dans packages/game.
create function public.survivants_quiz(p_manche uuid) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with qj as (select * from public.quiz_joueurs(p_manche))
  select coalesce(jsonb_object_agg(
    eq.numero::text,
    (select count(*) from qj where qj.equipe_id = eq.id and not qj.elimine)
  ), '{}'::jsonb)
  from public.manches m
  join public.equipes eq on eq.evenement_id = m.evenement_id
  where m.id = p_manche;
$$;

-- ---------------------------------------------------------------------------
-- Répondre depuis un téléphone
-- ---------------------------------------------------------------------------

-- Une réponse n'est acceptée que si tout tient : manche de quiz en mode téléphone, question
-- ouverte (étape `question`, chrono pas écoulé à l'heure de la base, une seconde de grâce pour
-- le trajet), joueur participant et pas éliminé, première réponse à cette question.
create function public.repondre_quiz(p_jeton_hash text, p_choix smallint) returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_pilotage public.pilotage;
  v_manche public.manches;
  v_elimine boolean;
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;

  select * into v_pilotage from public.pilotage pi where pi.evenement_id = v_joueur.evenement_id;
  select * into v_manche from public.manches m where m.id = v_pilotage.manche_id;

  if v_manche.jeu is distinct from 'qcm2'
    or coalesce(v_manche.options ->> 'mode', 'croix') <> 'telephone'
    or v_pilotage.scene <> 'jeu'
    or v_pilotage.etape is distinct from 'question'
    or v_pilotage.passage_id is null
    or v_pilotage.chrono_depart is null
    or clock_timestamp() > v_pilotage.chrono_depart
      + make_interval(secs => v_pilotage.chrono_duree_s + 1)
  then
    raise exception 'question fermée' using errcode = 'check_violation';
  end if;

  select qj.elimine into v_elimine
  from public.quiz_joueurs(v_manche.id) qj
  where qj.joueur_id = v_joueur.id;
  if not found then
    raise exception 'spectateur' using errcode = 'check_violation';
  end if;
  if v_elimine then
    raise exception 'éliminé' using errcode = 'check_violation';
  end if;

  insert into public.reponses_quiz (passage_id, evenement_id, joueur_id, choix)
  values (v_pilotage.passage_id, v_joueur.evenement_id, v_joueur.id, p_choix)
  on conflict do nothing;
  if not found then
    raise exception 'déjà répondu' using errcode = 'unique_violation';
  end if;

  return jsonb_build_object('passage_id', v_pilotage.passage_id, 'choix', p_choix);
end;
$$;

-- Ce que le téléphone d'un joueur sait du quiz en cours : rien en mode croix. En mode téléphone,
-- la question dans sa langue pendant qu'elle est ouverte ou révélée, sa réponse, son sort ; la
-- bonne réponse seulement une fois révélée à la salle.
create function public.quiz_du_joueur(p_joueur public.joueurs) returns jsonb
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
    or coalesce(v_manche.options ->> 'mode', 'croix') <> 'telephone'
    or v_pilotage.scene <> 'jeu'
  then
    return null;
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
-- État du téléphone : l'identifiant de l'événement (canal du signal) et le quiz
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
      'capitaine', j.capitaine
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
    'quiz', public.quiz_du_joueur(j)
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  left join public.classement c on c.equipe_id = eq.id
  where j.jeton_hash = p_jeton_hash;
$$;

-- ---------------------------------------------------------------------------
-- Ce que la salle voit des secrets : règles du quiz et du mime
-- ---------------------------------------------------------------------------

-- Ajouts au lot 6 :
--   Quiz : la bonne réponse une fois la question révélée (passage terminé), jamais pour une
--   question annulée.
--   Mime : le mot au verdict seulement (le passage se termine à « trouvé » ou « raté »).
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
      or (v_courant and p_pilotage.etape in ('sujet', 'chrono', 'tenu', 'rate')) then
      return v_secret;
    end if;
  elsif p_jeu = 'qcm2' then
    if p_passage.statut = 'termine'
      and not coalesce((p_passage.resultat ->> 'annulee')::boolean, false) then
      return v_secret;
    end if;
  elsif p_jeu = 'mime2' then
    if p_passage.statut = 'termine' then
      return v_secret;
    end if;
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Écran et régie : réponses reçues par question, survivants par équipe
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
      'client_nom', e.client_nom, 'creneau_minutes', e.creneau_minutes
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
          from public.joueurs j where j.equipe_id = eq.id), '[]'::jsonb)
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
              select count(*) from public.reponses_quiz r where r.passage_id = pa.id) end
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
-- Écriture d'une étape : la manche peut recevoir des options (le mode du quiz, choisi au
-- lancement). Le reste est inchangé depuis le lot 6.
-- ---------------------------------------------------------------------------

create or replace function public.enregistrer_etape(
  p_evenement uuid,
  p_version timestamptz,
  p_pilotage jsonb,
  p_passage jsonb default null,
  p_manche jsonb default null,
  p_scores jsonb default '[]'::jsonb
) returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version timestamptz;
  v_chrono text := coalesce(p_pilotage ->> 'chrono', 'garder');
  v_score jsonb;
begin
  update public.pilotage p set
    scene = (p_pilotage ->> 'scene')::public.scene,
    manche_id = (p_pilotage ->> 'manche_id')::uuid,
    passage_id = (p_pilotage ->> 'passage_id')::uuid,
    etape = p_pilotage ->> 'etape',
    indices = coalesce((p_pilotage ->> 'indices')::smallint, 0),
    chrono_duree_s = case
      when v_chrono = 'demarrer' then (p_pilotage ->> 'chrono_duree_s')::integer
      when v_chrono = 'arreter' then null
      else p.chrono_duree_s end,
    chrono_depart = case
      when v_chrono = 'demarrer' then now()
      when v_chrono = 'arreter' then null
      else p.chrono_depart end,
    maj_le = clock_timestamp()
  where p.evenement_id = p_evenement and p.maj_le = p_version
  returning p.maj_le into v_version;

  if v_version is null then
    raise exception 'pilotage périmé' using errcode = 'serialization_failure';
  end if;

  if p_passage is not null then
    update public.passages pa set
      statut = (p_passage ->> 'statut')::public.statut_passage,
      resultat = coalesce(p_passage -> 'resultat', pa.resultat),
      points = case when p_passage ? 'points' then (p_passage ->> 'points')::integer else pa.points end,
      commence_le = case
        when p_passage ->> 'statut' = 'en_cours' then coalesce(pa.commence_le, now())
        else pa.commence_le end,
      termine_le = case when p_passage ->> 'statut' = 'termine' then now() else null end
    where pa.id = (p_passage ->> 'id')::uuid and pa.evenement_id = p_evenement;
  end if;

  if p_manche is not null then
    update public.manches m set
      statut = (p_manche ->> 'statut')::public.statut_manche,
      options = m.options || coalesce(p_manche -> 'options', '{}'::jsonb),
      commence_le = case
        when p_manche ->> 'statut' = 'en_cours' then coalesce(m.commence_le, now())
        else m.commence_le end,
      termine_le = case when p_manche ->> 'statut' = 'terminee' then now() else m.termine_le end
    where m.id = (p_manche ->> 'id')::uuid and m.evenement_id = p_evenement;
  end if;

  for v_score in select * from jsonb_array_elements(p_scores) loop
    insert into public.scores (evenement_id, equipe_id, manche_id, points, motif, saisi_par)
    values (
      p_evenement,
      (v_score ->> 'equipe_id')::uuid,
      (v_score ->> 'manche_id')::uuid,
      (v_score ->> 'points')::integer,
      v_score ->> 'motif',
      (select auth.uid())
    );
  end loop;

  return v_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits
-- ---------------------------------------------------------------------------

-- Le chemin des téléphones : rôle de service seulement, comme au lot 3.
revoke execute on function
  public.repondre_quiz(text, smallint),
  public.quiz_du_joueur(public.joueurs)
  from public, anon, authenticated;

grant execute on function
  public.repondre_quiz(text, smallint),
  public.quiz_du_joueur(public.joueurs)
  to service_role;

-- Le compte des survivants sert à l'écran et à la régie, sous la RLS de l'animateur.
revoke execute on function
  public.quiz_joueurs(uuid),
  public.survivants_quiz(uuid)
  from public, anon;

grant execute on function
  public.quiz_joueurs(uuid),
  public.survivants_quiz(uuid)
  to authenticated, service_role;

-- La régie voit arriver les réponses (compteur « n / N ont répondu »).
alter publication supabase_realtime add table public.reponses_quiz;
