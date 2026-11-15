-- Relancer un jeu depuis le début (2026-11-15).
--
-- Le 2026-11-14, un quiz en mode jetons s'est fini sans que ses points soient écrits, et rien ne
-- permettait de le rejouer : une manche lancée ne revenait jamais « à venir ». La régie peut
-- désormais remettre un jeu à zéro d'une touche confirmée, qu'il soit en cours ou terminé.
--
-- Une transaction, sous la session de l'animateur (`anime()`), security definer parce que les
-- mises, les réponses et les mots ne s'écrivent que par leurs fonctions :
--   - les points déjà donnés par ce jeu sont annulés par une ligne contraire par équipe (le
--     journal des scores reste append-only : rien ne s'y efface) ;
--   - mises, réponses et mots de ses passages sont retirés, les gagnantes des photos aussi (les
--     photos elles-mêmes restent) ;
--   - ses passages et la manche redeviennent « à venir », le mode choisi au lancement est oublié
--     (il se rechoisit), l'ordre tiré et les réglages de la préparation sont gardés ;
--   - la salle revient à la présentation du jeu.

create function public.recommencer_manche(p_manche uuid, p_motif text) returns timestamptz
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

  -- Le mode (quiz, Surenchère), les jetons de départ, la fin demandée et les survivants validés
  -- viennent du lancement : ils repartent avec lui.
  update public.manches m set
    statut = 'a_venir',
    options = m.options - 'mode' - 'jetons' - 'fin' - 'survivants',
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

revoke execute on function public.recommencer_manche(uuid, text) from public, anon;
grant execute on function public.recommencer_manche(uuid, text) to authenticated;
