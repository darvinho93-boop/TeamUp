-- Deux joueurs d'une même soirée n'ont jamais le même prénom (2026-10-23).
--
-- Comparés sans casse, sans accents latins et sans espaces superflus : « Léa », « lea » et
-- « LÉA » sont le même prénom à l'écran. La garde vit dans `placer_joueur`, sous le verrou
-- d'arrivée : elle couvre le QR code, l'invité ajouté par un joueur et celui de la régie, et
-- deux arrivées simultanées du même prénom ne passent pas toutes les deux. Rien n'est ajouté à
-- la table : les doublons d'avant restent, ils ne gênent personne.

-- La forme comparée d'un prénom. Pas d'extension `unaccent` : les accents latins suffisent, le
-- tamoul n'en a pas.
create function public.cle_prenom(p_prenom text) returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    lower(regexp_replace(btrim(coalesce(p_prenom, '')), '\s+', ' ', 'g')),
    'àáâãäåāçćčèéêëēėęìíîïīñńòóôõöøōùúûüūýÿžźżšœæ',
    'aaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzzsoa'
  );
$$;

-- Reprise de 20261017110000_capitaines_et_noms.sql (même signature), la garde du prénom en plus.
create or replace function public.placer_joueur(
  p_evenement public.evenements,
  p_prenom text,
  p_langue public.langue,
  p_jeton_hash text,
  p_groupe uuid,
  p_volontaire boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_joueur public.joueurs;
  v_equipe public.equipes;
begin
  if p_langue <> all (p_evenement.langues) then
    raise exception 'langue non proposée pour cet événement' using errcode = 'check_violation';
  end if;

  if p_groupe is not null and not exists (
    select 1 from public.groupes g where g.id = p_groupe and g.evenement_id = p_evenement.id
  ) then
    raise exception 'groupe inconnu' using errcode = 'check_violation';
  end if;

  -- Une arrivée à la fois par événement, jusqu'à la fin de la transaction : les effectifs lus
  -- voient toujours les arrivées précédentes.
  perform pg_advisory_xact_lock(hashtextextended(p_evenement.id::text, 0));

  if (select count(*) from public.joueurs j where j.evenement_id = p_evenement.id) >= 150 then
    raise exception 'événement complet' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.joueurs j
    where j.evenement_id = p_evenement.id
      and public.cle_prenom(j.prenom) = public.cle_prenom(p_prenom)
  ) then
    raise exception 'prénom déjà pris' using errcode = 'unique_violation';
  end if;

  if p_groupe is null then
    -- Comme au lot 5 : la moins remplie, le plus petit numéro en cas d'égalité.
    select eq.* into v_equipe
    from public.equipes eq
    left join public.joueurs j on j.equipe_id = eq.id
    where eq.evenement_id = p_evenement.id
    group by eq.id
    order by count(j.id), eq.numero
    limit 1;
  else
    -- Celle qui compte le moins de ce groupe, puis le moins de joueurs, au hasard ensuite.
    select eq.* into v_equipe
    from public.equipes eq
    left join public.equipes_groupes eg on eg.equipe_id = eq.id and eg.groupe_id = p_groupe
    where eq.evenement_id = p_evenement.id
    order by
      coalesce(eg.effectif, 0),
      (select count(*) from public.joueurs j where j.equipe_id = eq.id),
      random()
    limit 1;

    if v_equipe.id is not null then
      insert into public.equipes_groupes (evenement_id, equipe_id, groupe_id, effectif)
      values (p_evenement.id, v_equipe.id, p_groupe, 1)
      on conflict (equipe_id, groupe_id) do update set effectif = public.equipes_groupes.effectif + 1;
    end if;
  end if;

  -- Un invité sans téléphone n'est jamais volontaire : il ne pourrait pas être capitaine.
  insert into public.joueurs (evenement_id, equipe_id, prenom, langue, jeton_hash, volontaire)
  values (
    p_evenement.id, v_equipe.id, btrim(p_prenom), p_langue, p_jeton_hash,
    coalesce(p_volontaire, false) and p_jeton_hash is not null
  )
  returning * into v_joueur;

  return jsonb_build_object(
    'joueur_id', v_joueur.id,
    'evenement_id', p_evenement.id,
    'code', p_evenement.code,
    'prenom', v_joueur.prenom,
    'langue', v_joueur.langue,
    'equipe', case when v_equipe.id is null then null else jsonb_build_object(
      'id', v_equipe.id,
      'numero', v_equipe.numero,
      'nom', v_equipe.nom
    ) end
  );
end;
$$;

revoke execute on function
  public.placer_joueur(public.evenements, text, public.langue, text, uuid, boolean)
  from public, anon, authenticated;

-- Le téléphone le demande dès la saisie du prénom, avant le groupe et « Capitaine ? » : l'invité
-- n'apprend pas le refus deux écrans plus loin. Indicatif seulement, `placer_joueur` tranche.
create function public.prenom_disponible(p_code text, p_prenom text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.joueurs j
    join public.evenements e on e.id = j.evenement_id
    where e.code = upper(p_code)
      and public.cle_prenom(j.prenom) = public.cle_prenom(p_prenom)
  );
$$;

revoke execute on function public.prenom_disponible(text, text) from public, anon, authenticated;
grant execute on function public.prenom_disponible(text, text) to service_role;
