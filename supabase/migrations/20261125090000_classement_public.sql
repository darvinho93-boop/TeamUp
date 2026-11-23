-- Classement au téléphone (2026-11-23, parcours joueur).
--
-- L'onglet Classement ne montre rien avant que le grand écran ait fini de dévoiler le podium. Une
-- clôture ne le prouve pas : seul le pilotage le sait. Le podium paraît en 3,5 s (trois marches,
-- `--tu-dur-podium-ecart` et `--tu-dur-podium`) ; on compte 5 s pour que l'écran, qui reçoit la
-- touche un instant après, ait toujours montré le premier avant les téléphones.
--
-- Une scène quittée avant ces 5 s ne publie rien. Une fois la scène quittée, les téléphones gardent
-- le dernier podium montré, même si des points changent ensuite : seuls les points déjà révélés
-- sortent. Rang, numéro, nom et points : rien d'autre.

alter table public.pilotage
  add column podium_depart timestamptz,
  add column podium_publie jsonb;

-- Le même ordre que `classement` de l'écran commun (points décroissants, puis numéro) : le rang
-- est la place à l'écran. `ex_aequo` signale une égalité sans changer cet ordre.
create function public.classement_podium(p_evenement uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'rang', l.rang,
    'numero', l.numero,
    'nom', l.nom,
    'points', l.points,
    'ex_aequo', l.egales > 1
  ) order by l.rang), '[]'::jsonb)
  from (
    select
      eq.numero,
      eq.nom,
      p.points,
      row_number() over (order by p.points desc, eq.numero)::integer as rang,
      count(*) over (partition by p.points) as egales
    from public.equipes eq
    cross join lateral (
      select coalesce(sum(s.points), 0)::integer as points
      from public.scores s
      where s.equipe_id = eq.id
    ) p
    where eq.evenement_id = p_evenement
  ) l;
$$;

revoke execute on function public.classement_podium(uuid) from public, anon, authenticated;

-- La régie écrit `pilotage` sous sa session : ces deux colonnes ne s'écrivent qu'ici.
create function public.pilotage_suivre_podium()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_maintenant timestamptz := clock_timestamp();
begin
  if tg_op = 'INSERT' then
    new.podium_depart := case when new.scene = 'podium' then v_maintenant end;
    new.podium_publie := null;
    return new;
  end if;

  new.podium_depart := old.podium_depart;
  new.podium_publie := old.podium_publie;

  if new.scene = 'podium' and old.scene is distinct from 'podium' then
    new.podium_depart := v_maintenant;
  elsif old.scene = 'podium' and new.scene is distinct from 'podium' then
    if old.podium_depart is not null
      and v_maintenant >= old.podium_depart + interval '5 seconds' then
      new.podium_publie := public.classement_podium(new.evenement_id);
    end if;
    new.podium_depart := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.pilotage_suivre_podium() from public, anon, authenticated;

create trigger pilotage_suivre_podium
  before insert or update on public.pilotage
  for each row execute function public.pilotage_suivre_podium();

-- Podium à l'écran depuis assez longtemps : les totaux de l'écran, en direct. Sinon, le dernier
-- podium entièrement montré, ou rien.
create function public.classement_du_joueur(p_pilotage public.pilotage)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_pilotage.scene = 'podium'
      and p_pilotage.podium_depart is not null
      and clock_timestamp() >= p_pilotage.podium_depart + interval '5 seconds'
      then public.classement_podium(p_pilotage.evenement_id)
    else p_pilotage.podium_publie
  end;
$$;

revoke execute on function public.classement_du_joueur(public.pilotage)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- etat_joueur : reprise de 20261123090000_tournoi_gobelet.sql, le classement en plus
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
    -- Le classement, une fois le podium entièrement montré par le grand écran (2026-11-23).
    'classement', case when pi.evenement_id is not null
      then public.classement_du_joueur(pi) end,
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
