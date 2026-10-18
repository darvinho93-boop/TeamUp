-- Quiz et Mime à l'écran commun (2026-10-18).

-- ---------------------------------------------------------------------------
-- Quiz : les propositions A, B, C, D affichées une à une
-- ---------------------------------------------------------------------------

-- Après la question seule, la régie affiche A, B, C puis D, une touche chacune, avant de lancer
-- le chrono. Le nombre de propositions affichées vit dans `pilotage.indices`, que le quiz
-- n'utilisait pas ; il va jusqu'à 4, quand les indices de Points communs s'arrêtaient à 2.
alter table public.pilotage drop constraint pilotage_indices_check;
alter table public.pilotage add constraint pilotage_indices_check check (indices between 0 and 4);

-- ---------------------------------------------------------------------------
-- Mime : le mot à l'écran le temps que le premier de la file le lise
-- ---------------------------------------------------------------------------

-- Jusqu'ici, le mot ne paraissait que sur l'écran de régie, où le premier de la file venait le
-- lire (spec v3, jeu 04). À la demande de l'animateur, il s'affiche désormais aussi sur l'écran
-- commun à l'étape « secret » : le reste de la file est dos tourné. Il disparaît dès que la
-- chaîne est lancée (« lance ») et revient au verdict. Aucun téléphone ne le reçoit : cette
-- fonction ne sert qu'à `etat_ecran`, sous la session de l'animateur.

-- Reprise de 20260925090000_quiz_et_mime.sql, seule la branche du mime change.
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
    -- Le mot paraît à l'écran le temps que le premier de la file le lise (étape « secret »),
    -- disparaît au lancement de la chaîne, revient au verdict (2026-10-18).
    if p_passage.statut = 'termine' or (v_courant and p_pilotage.etape = 'secret') then
      return v_secret;
    end if;
  end if;

  return null;
end;
$$;
