-- Messages sur le grand écran (2026-11-15).
--
-- Un joueur qui a un téléphone écrit un message court ; il paraît aussitôt sur l'écran commun,
-- dans une bulle temporaire, avec son prénom. La régie écrit aussi (sous « Team Up! »), retire
-- un message (il quitte l'écran) et ferme les envois. Écart assumé à la spec v3 : un usage du
-- téléphone hors jeu, comme le renommage d'équipe.
--
-- Aucune écriture directe : `envoyer_message` (le joueur, par le serveur, rôle de service),
-- `envoyer_message_regie` et `retirer_message` (l'animateur), `regler_messages` (le pilotage).

alter table public.pilotage
  add column messages_ouverts boolean not null default true;

comment on column public.pilotage.messages_ouverts is
  'Les joueurs peuvent écrire sur le grand écran (touche de la régie).';

create table public.messages_salle (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenements (id) on delete cascade,
  -- Null : un message de la régie, ou d'un joueur retiré depuis (son prénom reste).
  joueur_id uuid references public.joueurs (id) on delete set null,
  regie boolean not null default false,
  -- Figé à l'envoi : un joueur retiré ou renommé ne change pas un message déjà paru.
  prenom text,
  equipe_id uuid references public.equipes (id) on delete set null,
  texte text not null check (char_length(texte) between 1 and 100),
  cree_le timestamptz not null default clock_timestamp(),
  retire boolean not null default false,
  check (regie = (prenom is null))
);

create index messages_salle_evenement_idx on public.messages_salle (evenement_id, cree_le desc);
create index messages_salle_joueur_idx on public.messages_salle (joueur_id, cree_le desc);

alter table public.messages_salle enable row level security;

create policy "animateur lit les messages de ses événements" on public.messages_salle
  for select to authenticated
  using (public.anime(evenement_id));

-- Une ligne, des espaces réduits, sans caractère de contrôle. Vide ou au-delà de 100 : null.
create function public.nettoyer_message(p_texte text) returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(t) between 1 and 100 then t end
  from (
    select btrim(regexp_replace(coalesce(p_texte, ''), '[[:cntrl:][:space:]]+', ' ', 'g')) as t
  ) n;
$$;

-- ---------------------------------------------------------------------------
-- Envois
-- ---------------------------------------------------------------------------

-- Le joueur de cette session. Refus : session inconnue, partie terminée, envois fermés, texte
-- invalide, moins de 20 s depuis son dernier message (« trop tôt:<secondes restantes> »).
create function public.envoyer_message(p_jeton_hash text, p_texte text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_statut public.statut_evenement;
  v_ouverts boolean;
  v_texte text := public.nettoyer_message(p_texte);
  v_dernier timestamptz;
  v_message public.messages_salle;
begin
  -- Le verrou du joueur : deux envois simultanés ne passent pas tous les deux la cadence.
  select * into v_joueur from public.joueurs j where j.jeton_hash = p_jeton_hash for update;
  if not found then
    raise exception 'session inconnue' using errcode = 'no_data_found';
  end if;

  select e.statut, pi.messages_ouverts into v_statut, v_ouverts
  from public.evenements e
  join public.pilotage pi on pi.evenement_id = e.id
  where e.id = v_joueur.evenement_id;
  if v_statut = 'termine' then
    raise exception 'partie terminée' using errcode = 'PT409';
  end if;
  if not v_ouverts then
    raise exception 'messages fermés' using errcode = 'PT403';
  end if;

  if v_texte is null then
    raise exception 'message invalide' using errcode = 'check_violation';
  end if;

  select max(m.cree_le) into v_dernier from public.messages_salle m where m.joueur_id = v_joueur.id;
  if v_dernier is not null and v_dernier > clock_timestamp() - interval '20 seconds' then
    raise exception 'trop tôt:%',
      ceil(extract(epoch from v_dernier + interval '20 seconds' - clock_timestamp()))::integer
      using errcode = 'PT429';
  end if;

  insert into public.messages_salle (evenement_id, joueur_id, prenom, equipe_id, texte)
  values (v_joueur.evenement_id, v_joueur.id, v_joueur.prenom, v_joueur.equipe_id, v_texte)
  returning * into v_message;

  return jsonb_build_object(
    'id', v_message.id,
    'evenement_id', v_message.evenement_id,
    'cree_ms', floor(extract(epoch from v_message.cree_le) * 1000)
  );
end;
$$;

revoke execute on function public.envoyer_message(text, text) from public, anon, authenticated;
grant execute on function public.envoyer_message(text, text) to service_role;

-- La régie écrit sous « Team Up! » ; envois fermés ou non, partie terminée ou non.
create function public.envoyer_message_regie(p_evenement uuid, p_texte text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texte text := public.nettoyer_message(p_texte);
  v_id uuid;
begin
  if not public.anime(p_evenement) then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
  if v_texte is null then
    raise exception 'message invalide' using errcode = 'check_violation';
  end if;
  insert into public.messages_salle (evenement_id, regie, texte)
  values (p_evenement, true, v_texte)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.envoyer_message_regie(uuid, text) from public, anon;
grant execute on function public.envoyer_message_regie(uuid, text) to authenticated;

-- Retirer (ou remettre, par erreur de doigt) un message : il quitte l'écran tout de suite.
create function public.retirer_message(p_message uuid, p_retire boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evenement uuid;
begin
  select m.evenement_id into v_evenement from public.messages_salle m where m.id = p_message;
  if v_evenement is null or not public.anime(v_evenement) then
    raise exception 'accès refusé' using errcode = 'insufficient_privilege';
  end if;
  update public.messages_salle set retire = p_retire where id = p_message;
end;
$$;

revoke execute on function public.retirer_message(uuid, boolean) from public, anon;
grant execute on function public.retirer_message(uuid, boolean) to authenticated;

-- Comme `regler_son` : ne touche pas à `maj_le` (pas de « pilotage périmé » à la touche
-- suivante). Security invoker : la policy « animateur pilote ses événements » tranche.
create function public.regler_messages(p_evenement uuid, p_ouverts boolean)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.pilotage
  set messages_ouverts = p_ouverts
  where evenement_id = p_evenement;
$$;

revoke execute on function public.regler_messages(uuid, boolean) from public, anon;
grant execute on function public.regler_messages(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Lecture
-- ---------------------------------------------------------------------------

-- L'écran : les 20 derniers des deux dernières minutes, retirés exclus (il planifie ses bulles
-- d'après `cree_ms`). La régie : les 30 derniers, retirés compris, pour les retirer ou les
-- remettre. Security invoker : la policy de lecture tranche.
create function public.messages_ecran(p_evenement uuid, p_regie boolean) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'prenom', m.prenom,
    'regie', m.regie,
    'equipe', eq.numero,
    'texte', m.texte,
    'cree_ms', floor(extract(epoch from m.cree_le) * 1000),
    'retire', m.retire
  ) order by m.cree_le), '[]'::jsonb)
  from (
    select * from public.messages_salle ms
    where ms.evenement_id = p_evenement
      and (p_regie or (not ms.retire and ms.cree_le > clock_timestamp() - interval '2 minutes'))
    order by ms.cree_le desc
    limit case when p_regie then 30 else 20 end
  ) m
  left join public.equipes eq on eq.id = m.equipe_id;
$$;

revoke execute on function public.messages_ecran(uuid, boolean) from public, anon;
grant execute on function public.messages_ecran(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- `etat_ecran` et `etat_joueur`
-- ---------------------------------------------------------------------------

-- Reprise de 20261111090000_logo_partenaire.sql, avec `messages_ouverts` et `messages`.
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
            -- Surenchère en mode téléphones : les mots de chaque équipe (2026-11-08).
            'mots', case when m.jeu = 'enchere2' and m.options ->> 'mode' = 'telephones'
              then public.mots_ecran(pa, pi, p_regie) end,
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

-- Reprise de 20261108090000_surenchere_telephones.sql, avec `evenement.messages_ouverts` (le
-- bouton du téléphone) : une seule ligne de pilotage lue, rien qui parcoure la soirée.
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
      'messages_ouverts', (select pi.messages_ouverts from public.pilotage pi where pi.evenement_id = e.id)
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
    'photos', public.photos_du_joueur(j)
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  where j.jeton_hash = p_jeton_hash;
$$;
