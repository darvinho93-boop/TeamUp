import 'server-only';
import { notFound } from 'next/navigation';
import { normaliserCode, type Langue } from '@/lib/partie';
import { exigerAnimateur } from './supabase-animateur';

export interface EvenementRegie {
  id: string;
  code: string;
  client_nom: string;
  type_client: 'particulier' | 'entreprise';
  creneau_minutes: number;
  langues: Langue[];
  statut: 'preparation' | 'repetition' | 'en_cours' | 'termine';
  /** Nombre d'équipes prévu à la création : durée prévue, valeur proposée à la formation. */
  equipes_prevues: number;
}

const COLONNES =
  'id, code, client_nom, type_client, creneau_minutes, langues, statut, termine_le, equipes_prevues';

/**
 * L'événement d'une page de la régie, lu sous la session de l'animateur : un code qui n'est pas
 * le sien (RLS) donne une page introuvable, pas une erreur qui confirmerait son existence.
 */
export async function evenementDeLaRegie(brut: string) {
  const { supabase, animateur } = await exigerAnimateur();
  const code = normaliserCode(brut);
  if (!code) notFound();
  const { data: evenement } = await supabase
    .from('evenements')
    .select(COLONNES)
    .eq('code', code)
    .maybeSingle();
  if (!evenement) notFound();
  return { supabase, animateur, evenement };
}
