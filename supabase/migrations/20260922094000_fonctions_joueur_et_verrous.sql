-- Le chemin des joueurs, et le verrou qui le rend sûr.
--
-- Un joueur n'a ni compte, ni clé Supabase : son navigateur ne parle qu'au serveur de l'app,
-- qui appelle ces fonctions avec le rôle de service. Elles prennent toutes le SHA-256 du jeton
-- de session, jamais le jeton lui-même.
--
-- La garantie du lot est ici : `anon` perd tout droit sur le schéma public, et le seul chemin
-- vers un secret est `secret_du_joueur`, qui n'en sort un que pour le joueur désigné, pendant
-- son passage. Ce n'est pas l'interface qui masque, c'est la base qui refuse.

-- Entrée dans la partie par le code de salle. Refuse un code expiré, un événement terminé,
-- une langue non proposée, et s'arrête à 150 joueurs (capacité cible du cahier des charges).
create function public.rejoindre_evenement(
  p_code text,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evenement public.evenements;
  v_joueur public.joueurs;
begin
  select * into v_evenement
  from public.evenements e
  where e.code = upper(p_code)
    and e.statut in ('preparation', 'repetition', 'en_cours')
    and (e.code_expire_le is null or e.code_expire_le > now());

  if not found then
    raise exception 'code inconnu ou expiré' using errcode = 'no_data_found';
  end if;

  if (select count(*) from public.joueurs j where j.evenement_id = v_evenement.id) >= 150 then
    raise exception 'événement complet' using errcode = 'check_violation';
  end if;

  if p_langue <> all (v_evenement.langues) then
    raise exception 'langue non proposée pour cet événement' using errcode = 'check_violation';
  end if;

  insert into public.joueurs (evenement_id, prenom, langue, jeton_hash)
  values (v_evenement.id, btrim(p_prenom), p_langue, p_jeton_hash)
  returning * into v_joueur;

  return jsonb_build_object(
    'joueur_id', v_joueur.id,
    'evenement_id', v_evenement.id,
    'code', v_evenement.code,
    'prenom', v_joueur.prenom,
    'langue', v_joueur.langue
  );
end;
$$;

-- Ce que l'écran d'attente a le droit de savoir : son équipe, son score, le jeu en cours.
-- Aucun secret n'y transite, quel que soit le joueur.
create function public.etat_joueur(p_jeton_hash text) returns jsonb
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
    )
  )
  from public.joueurs j
  join public.evenements e on e.id = j.evenement_id
  left join public.equipes eq on eq.id = j.equipe_id
  left join public.classement c on c.equipe_id = eq.id
  where j.jeton_hash = p_jeton_hash;
$$;

-- Le seul chemin de sortie d'un secret vers un téléphone.
-- Trois conditions, toutes vérifiées ici : le jeton existe, son joueur est le destinataire
-- désigné du passage, et ce passage est en cours.
create function public.secret_du_joueur(p_jeton_hash text) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'passage_id', p.id,
    'jeu', m.jeu,
    'valeur', cs.valeur
  )
  from public.joueurs j
  join public.passages p on p.joueur_designe_id = j.id and p.statut = 'en_cours'
  join public.manches m on m.id = p.manche_id
  join public.contenus_secrets cs on cs.contenu_id = p.contenu_id
  where j.jeton_hash = p_jeton_hash
    and p.evenement_id = j.evenement_id
  -- La langue du joueur si elle existe, le français sinon.
  order by (cs.langue = j.langue) desc, (cs.langue = 'fr') desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Verrous
-- ---------------------------------------------------------------------------

-- Ces fonctions ne sont appelables que par le serveur de l'app.
revoke execute on function
  public.rejoindre_evenement(text, text, public.langue, text),
  public.etat_joueur(text),
  public.secret_du_joueur(text)
  from public, anon, authenticated;

grant execute on function
  public.rejoindre_evenement(text, text, public.langue, text),
  public.etat_joueur(text),
  public.secret_du_joueur(text)
  to service_role;

-- Aucun joueur n'utilise de clé Supabase : `anon` n'a donc rien à faire dans le schéma public.
-- La RLS suffirait, mais un droit retiré ne dépend pas d'avoir écrit la bonne policy.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke usage on schema public from anon;

-- Vaut aussi pour les tables des migrations suivantes.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;
