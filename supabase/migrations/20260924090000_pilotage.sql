-- Le pilotage d'une soirée (lot 6) : ce que la régie commande et ce que l'écran commun affiche.
--
-- Une ligne `pilotage` par événement dit où en est la salle : la scène projetée, la manche et le
-- passage en cours, l'étape du jeu, le chrono. La régie l'écrit par `enregistrer_etape`, en une
-- transaction avec le passage, la manche et les points ; l'écran la lit par `etat_ecran` à chaque
-- changement reçu en temps réel.
--
-- Tout passe par la session de l'animateur (security invoker) : la RLS du lot 3 s'applique, un
-- animateur ne pilote et ne voit que ses événements. Les joueurs n'ont toujours accès à rien.

create type public.scene as enum (
  'accueil', 'equipes', 'programme', 'intro', 'jeu', 'scores', 'podium'
);

create table public.pilotage (
  evenement_id uuid primary key references public.evenements (id) on delete cascade,
  scene public.scene not null default 'accueil',
  manche_id uuid,
  passage_id uuid,
  -- Étape du jeu en cours, propre à chaque jeu (packages/game/src/pilotage).
  etape text,
  -- Heure de la base au lancement du chrono : la seule horloge qui fait foi.
  chrono_depart timestamptz,
  chrono_duree_s integer check (chrono_duree_s > 0),
  -- Indices de Points communs déjà montrés à la salle.
  indices smallint not null default 0 check (indices between 0 and 2),
  -- Version de la ligne : une écriture qui part d'un état périmé est refusée.
  maj_le timestamptz not null default clock_timestamp(),
  foreign key (manche_id, evenement_id)
    references public.manches (id, evenement_id) on delete set null (manche_id),
  foreign key (passage_id, evenement_id)
    references public.passages (id, evenement_id) on delete set null (passage_id)
);

alter table public.pilotage enable row level security;

create policy "animateur lit le pilotage de ses événements" on public.pilotage
  for select to authenticated
  using (public.anime(evenement_id));

create policy "animateur pilote ses événements" on public.pilotage
  for update to authenticated
  using (public.anime(evenement_id))
  with check (public.anime(evenement_id));

-- Chaque événement naît avec sa ligne de pilotage, sur la scène d'accueil.
create function public.creer_pilotage() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pilotage (evenement_id) values (new.id);
  return new;
end;
$$;

create trigger evenements_pilotage
  after insert on public.evenements
  for each row execute function public.creer_pilotage();

insert into public.pilotage (evenement_id) select id from public.evenements;

-- ---------------------------------------------------------------------------
-- Code de salle tiré au hasard à la création d'un événement
-- ---------------------------------------------------------------------------

create function public.nouveau_code() returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.evenements e where e.code = v_code);
  end loop;
  return v_code;
end;
$$;

alter table public.evenements alter column code set default public.nouveau_code();

-- ---------------------------------------------------------------------------
-- Écriture d'une étape : pilotage, passage, manche et points, ensemble ou pas du tout
-- ---------------------------------------------------------------------------

-- p_pilotage : { scene, manche_id, passage_id, etape, indices, chrono_duree_s,
--                chrono: 'demarrer' | 'arreter' | 'garder' }
-- p_passage  : null ou { id, statut, resultat, points }
-- p_manche   : null ou { id, statut }
-- p_scores   : [{ equipe_id, points, motif, manche_id }]
--
-- Renvoie la nouvelle version (`maj_le`). Lève `pilotage périmé` si la ligne a changé depuis
-- `p_version` : un double appui sur « Valider » ne compte pas deux fois les points.
create function public.enregistrer_etape(
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
-- Ce que l'écran commun affiche, en une lecture
-- ---------------------------------------------------------------------------

-- Traductions d'un contenu dans les langues de l'événement : { "fr": {...}, "ta": {...} }.
create function public.contenu_public(p_contenu uuid, p_langues public.langue[]) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(t.langue, t.valeur), '{}'::jsonb)
  from public.contenus_traductions t
  where t.contenu_id = p_contenu and t.langue = any (p_langues);
$$;

create function public.contenu_secret(p_contenu uuid, p_langues public.langue[]) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(s.langue, s.valeur), '{}'::jsonb)
  from public.contenus_secrets s
  where s.contenu_id = p_contenu and s.langue = any (p_langues);
$$;

-- Ce que la salle a le droit de voir du secret d'un passage, à cette étape. La régie
-- (`p_regie`) voit tout : l'animateur doit connaître la réponse pour juger.
--   Points communs : la réponse pendant `consigne` seulement ; les indices déjà donnés ensuite.
--   Surenchère : le sujet dès qu'il est dévoilé, et pour les thèmes déjà joués.
create function public.secret_visible(
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
  end if;

  return null;
end;
$$;

create function public.etat_ecran(p_code text, p_regie boolean default false) returns jsonb
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
            'secret', public.secret_visible(m.jeu, pa, pi, e.langues, p_regie)
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
-- Droits : les comptes animateurs seulement
-- ---------------------------------------------------------------------------

revoke execute on function
  public.enregistrer_etape(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb),
  public.etat_ecran(text, boolean),
  public.secret_visible(public.jeu, public.passages, public.pilotage, public.langue[], boolean),
  public.contenu_public(uuid, public.langue[]),
  public.contenu_secret(uuid, public.langue[]),
  public.nouveau_code(),
  public.creer_pilotage()
  from public, anon;

grant execute on function
  public.enregistrer_etape(uuid, timestamptz, jsonb, jsonb, jsonb, jsonb),
  public.etat_ecran(text, boolean),
  public.secret_visible(public.jeu, public.passages, public.pilotage, public.langue[], boolean),
  public.contenu_public(uuid, public.langue[]),
  public.contenu_secret(uuid, public.langue[]),
  public.nouveau_code()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Temps réel : l'écran et la régie sont prévenus de chaque changement.
-- postgres_changes applique la RLS de l'abonné : seul un animateur de l'événement reçoit.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime
  add table public.pilotage, public.scores, public.joueurs, public.passages, public.manches;
