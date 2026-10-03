import 'server-only';
import type { EtatJoueur, EvenementPublic, Langue, RefusQuiz } from '@/lib/partie';
import { hacher, jetonDe } from './session';
import { supabaseService } from './supabase';

/** Un code ouvert à l'arrivée, ou `null`. */
export async function evenementPublic(code: string): Promise<EvenementPublic | null> {
  const { data, error } = await supabaseService().rpc('evenement_public', { p_code: code });
  if (error) throw new Error(error.message);
  return (data as EvenementPublic | null) ?? null;
}

/**
 * État du joueur de cette salle, d'après son cookie ; `null` sans session valable.
 * Marque le joueur comme vu au passage.
 */
export async function etatDuJoueur(code: string): Promise<EtatJoueur | null> {
  const jeton = await jetonDe(code);
  return jeton ? etatPourJeton(code, jeton) : null;
}

export async function etatPourJeton(code: string, jeton: string): Promise<EtatJoueur | null> {
  const { data, error } = await supabaseService().rpc('pouls_joueur', {
    p_jeton_hash: hacher(jeton),
  });
  if (error) throw new Error(error.message);
  const etat = (data as EtatJoueur | null) ?? null;
  // Un cookie d'une autre salle ne vaut rien ici, même si le nom collait.
  return etat?.evenement.code === code ? etat : null;
}

export type ResultatArrivee =
  { ok: true } | { ok: false; erreur: 'code_inconnu' | 'complet' | 'langue' | 'groupe' };

export async function rejoindre(
  code: string,
  prenom: string,
  langue: Langue,
  jeton: string,
  /** Le groupe ne sert qu'au tirage de l'équipe : la base ne le range pas sur le joueur. */
  groupe: string | null = null,
): Promise<ResultatArrivee> {
  const { error } = await supabaseService().rpc('rejoindre_evenement', {
    p_code: code,
    p_prenom: prenom,
    p_langue: langue,
    p_jeton_hash: hacher(jeton),
    ...(groupe ? { p_groupe: groupe } : {}),
  });
  if (!error) return { ok: true };
  if (/complet/.test(error.message)) return { ok: false, erreur: 'complet' };
  if (/langue/.test(error.message)) return { ok: false, erreur: 'langue' };
  if (/groupe/.test(error.message)) return { ok: false, erreur: 'groupe' };
  if (/inconnu|expiré/.test(error.message)) return { ok: false, erreur: 'code_inconnu' };
  throw new Error(error.message);
}

/**
 * Réponse au quiz du joueur de ce cookie. La base décide seule de ce qui est recevable
 * (question ouverte, joueur encore en jeu, première réponse) : on ne fait que traduire son refus.
 */
export async function repondreQuiz(
  code: string,
  choix: number,
): Promise<{ ok: true; etat: EtatJoueur } | { ok: false; refus: RefusQuiz }> {
  const jeton = await jetonDe(code);
  const etat = jeton ? await etatPourJeton(code, jeton) : null;
  if (!jeton || !etat) return { ok: false, refus: 'session' };

  const { error } = await supabaseService().rpc('repondre_quiz', {
    p_jeton_hash: hacher(jeton),
    p_choix: choix,
  });
  if (error) {
    const refus: RefusQuiz | null = /fermée/.test(error.message)
      ? 'fermee'
      : /spectateur/.test(error.message)
        ? 'spectateur'
        : /éliminé/.test(error.message)
          ? 'elimine'
          : /déjà/.test(error.message)
            ? 'deja'
            : /session/.test(error.message)
              ? 'session'
              : null;
    if (!refus) throw new Error(error.message);
    return { ok: false, refus };
  }
  return { ok: true, etat: (await etatPourJeton(code, jeton)) ?? etat };
}
