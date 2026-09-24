-- Photo challenge (lot 8).
--
-- Une surface ouverte toute la soirée (spec v3, jeu 05) : les thèmes sont les passages de la
-- manche `photo2`, le capitaine envoie une photo par thème, remplaçable jusqu'à la clôture.
-- Les téléphones n'écrivent que par `envoyer_photo` (rôle de service) ; le fichier, lui, est
-- déposé dans le bucket par le serveur de l'app, avant l'appel.
--
-- Clôture des envois (tranché le 2026-09-24) : la régie la pose quand elle veut, et le lancement
-- de la diffusion la pose de toute façon. Conservation des photos : remise au lot 10.

-- ---------------------------------------------------------------------------
-- Envoi d'une photo par le capitaine
-- ---------------------------------------------------------------------------

-- Refus, dans cet ordre : session inconnue, pas capitaine, envois clos (à l'heure de la base),
-- thème étranger à la manche photo de l'événement. Sinon, la photo de l'équipe pour ce thème
-- est posée ou remplacée ; renvoie l'ancien chemin (à retirer du bucket), ou null. Renvoyer le
-- même chemin ne change rien : la file d'attente du téléphone peut réessayer sans risque.
create function public.envoyer_photo(p_jeton_hash text, p_theme uuid, p_chemin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_closes timestamptz;
  v_ancien text;
begin
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;
  if not v_joueur.capitaine or v_joueur.equipe_id is null then
    raise exception 'pas capitaine' using errcode = 'insufficient_privilege';
  end if;

  -- Verrou sur l'événement : une clôture concurrente passe avant ou après, jamais pendant.
  select e.photos_closes_le into v_closes
  from public.evenements e where e.id = v_joueur.evenement_id
  for share;
  if v_closes is not null then
    raise exception 'envois clos' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1
    from public.passages pa
    join public.manches m on m.id = pa.manche_id
    where m.evenement_id = v_joueur.evenement_id and m.jeu = 'photo2' and pa.contenu_id = p_theme
  ) then
    raise exception 'thème inconnu' using errcode = 'foreign_key_violation';
  end if;

  -- Le chemin impose le dossier de l'équipe : un chemin d'ailleurs ne passe pas.
  if split_part(p_chemin, '/', 1) <> v_joueur.evenement_id::text
    or split_part(p_chemin, '/', 2) <> v_joueur.equipe_id::text then
    raise exception 'chemin refusé' using errcode = 'check_violation';
  end if;

  select ph.chemin into v_ancien
  from public.photos ph
  where ph.equipe_id = v_joueur.equipe_id and ph.theme_id = p_theme
  for update;

  insert into public.photos (evenement_id, equipe_id, theme_id, chemin, envoyee_par)
  values (v_joueur.evenement_id, v_joueur.equipe_id, p_theme, p_chemin, v_joueur.id)
  on conflict (equipe_id, theme_id) do update set
    chemin = excluded.chemin,
    envoyee_par = excluded.envoyee_par,
    envoyee_le = case
      when public.photos.chemin = excluded.chemin then public.photos.envoyee_le
      else now() end,
    gagnante = false;

  return jsonb_build_object(
    'ancien', case when v_ancien is distinct from p_chemin then v_ancien end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Clôture automatique au lancement de la diffusion
-- ---------------------------------------------------------------------------

create function public.clore_photos_a_la_diffusion() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.evenements e
  set photos_closes_le = now()
  where e.id = new.evenement_id and e.photos_closes_le is null;
  return new;
end;
$$;

create trigger manches_clore_photos
  after update of statut on public.manches
  for each row
  when (new.jeu = 'photo2' and new.statut = 'en_cours' and old.statut is distinct from 'en_cours')
  execute function public.clore_photos_a_la_diffusion();

-- ---------------------------------------------------------------------------
-- La gagnante d'un thème, reportée sur sa photo
-- ---------------------------------------------------------------------------

-- `enregistrer_etape` termine le passage du thème avec `resultat.equipe_gagnante` (un numéro
-- d'équipe, ou null). La photo gagnante le devient ici, dans la même transaction : l'export du
-- lot 10 n'aura qu'à lire `photos.gagnante`.
create function public.reporter_gagnante_photo() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.manches m where m.id = new.manche_id and m.jeu = 'photo2'
  ) then
    return new;
  end if;

  update public.photos ph set gagnante = false
  where ph.evenement_id = new.evenement_id and ph.theme_id = new.contenu_id and ph.gagnante;

  update public.photos ph set gagnante = true
  from public.equipes eq
  where ph.evenement_id = new.evenement_id
    and ph.theme_id = new.contenu_id
    and eq.id = ph.equipe_id
    and eq.numero = (new.resultat ->> 'equipe_gagnante')::smallint;
  return new;
end;
$$;

create trigger passages_gagnante_photo
  after update of resultat on public.passages
  for each row
  when (new.resultat ? 'equipe_gagnante')
  execute function public.reporter_gagnante_photo();

-- ---------------------------------------------------------------------------
-- État du téléphone : les thèmes et les envois de son équipe
-- ---------------------------------------------------------------------------

-- Thèmes dans la langue du joueur (à défaut, la première de la soirée) et, pour chacun, l'heure
-- d'envoi de la photo de son équipe. Aucune image, aucun chemin, rien d'une autre équipe.
create function public.photos_du_joueur(p_joueur public.joueurs) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when count(pa.id) = 0 then null else jsonb_build_object(
    'closes', (select e.photos_closes_le is not null
               from public.evenements e where e.id = p_joueur.evenement_id),
    'themes', jsonb_agg(jsonb_build_object(
      'theme_id', pa.contenu_id,
      'theme', coalesce(
        (select t.valeur ->> 'theme' from public.contenus_traductions t
         where t.contenu_id = pa.contenu_id and t.langue = p_joueur.langue),
        (select t.valeur ->> 'theme' from public.contenus_traductions t
         join public.evenements e on e.id = p_joueur.evenement_id
         where t.contenu_id = pa.contenu_id and t.langue = e.langues[1])),
      'envoyee_le', (
        select floor(extract(epoch from ph.envoyee_le) * 1000)
        from public.photos ph
        where ph.equipe_id = p_joueur.equipe_id and ph.theme_id = pa.contenu_id)
    ) order by pa.ordre)
  ) end
  from public.passages pa
  join public.manches m on m.id = pa.manche_id
  where m.evenement_id = p_joueur.evenement_id
    and m.jeu = 'photo2'
    and m.statut <> 'annulee'
    and pa.contenu_id is not null;
$$;

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
    'quiz', public.quiz_du_joueur(j),
    'photos', public.photos_du_joueur(j)
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  left join public.classement c on c.equipe_id = eq.id
  where j.jeton_hash = p_jeton_hash;
$$;

-- ---------------------------------------------------------------------------
-- Écran et régie : la clôture, et les photos de chaque thème
-- ---------------------------------------------------------------------------

-- L'écran reçoit les photos une fois la diffusion lancée, pour préparer toutes les images
-- d'avance (changer de thème ne coûte alors aucune requête) ; la régie les reçoit toujours,
-- pour suivre les envois. Des chemins seulement : les images passent par des URL signées,
-- que seule la session de l'animateur peut obtenir (policy du bucket, lot 3).
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
      'photos_closes', e.photos_closes_le is not null
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
              select count(*) from public.reponses_quiz r where r.passage_id = pa.id) end,
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
-- Droits
-- ---------------------------------------------------------------------------

-- Le chemin des téléphones : rôle de service seulement, comme au lot 3.
revoke execute on function
  public.envoyer_photo(text, uuid, text),
  public.photos_du_joueur(public.joueurs)
  from public, anon, authenticated;

grant execute on function
  public.envoyer_photo(text, uuid, text),
  public.photos_du_joueur(public.joueurs)
  to service_role;

-- Fonctions de déclencheur : jamais appelées directement.
revoke execute on function
  public.clore_photos_a_la_diffusion(),
  public.reporter_gagnante_photo()
  from public, anon, authenticated;

-- La page Photos de la régie voit arriver les envois des capitaines.
alter publication supabase_realtime add table public.photos;
