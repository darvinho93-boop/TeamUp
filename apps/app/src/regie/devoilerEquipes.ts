import { calculerEtape, type Motifs } from '@/lib/pilotage';
import type { EtatSalle } from '@/lib/salle';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import type { Json } from '@/types/base';

/** Le dévoilement n'écrit aucun point : pas de libellé de journal. */
const SANS_MOTIF: Motifs = {
  pointsCommuns: () => '',
  tenu: '',
  rate: '',
  podiumMots: () => '',
  quiz: () => '',
  quizJetons: () => '',
  mime: () => '',
  photo: () => '',
  duel: () => '',
};

/**
 * Lance le dévoilement des équipes à l'écran, comme la touche « Dévoiler les équipes » du
 * pilotage (2026-11-04) : la Salle l'appelle juste après avoir formé (ou refait) les équipes.
 * Relit l'état pour sa version ; si le pilotage a bougé entre-temps, rien n'est écrit (la touche
 * du pilotage reste là pour le lancer).
 */
export async function devoilerEquipes(code: string): Promise<boolean> {
  const supabase = supabaseNavigateur();
  const { data, error } = await supabase.rpc('etat_ecran', { p_code: code, p_regie: true });
  if (error || !data) return false;
  const etat = data as unknown as EtatSalle;
  const ecriture = calculerEtape(etat, { type: 'devoilerEquipes' }, 0, SANS_MOTIF);
  if (!ecriture) return false;
  const { error: refus } = await supabase.rpc('enregistrer_etape', {
    p_evenement: etat.evenement.id,
    p_version: etat.pilotage.version,
    p_pilotage: ecriture.pilotage as unknown as Json,
    p_passage: ecriture.passage as unknown as Json,
    p_manche: ecriture.manche as unknown as Json,
    p_scores: ecriture.scores,
  });
  return !refus;
}
