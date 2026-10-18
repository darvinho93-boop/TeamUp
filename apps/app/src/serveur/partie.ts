import 'server-only';
import type { EtatJoueur, EvenementPublic, Langue, RefusMise, RefusQuiz } from '@/lib/partie';
import { hacher, jetonDe } from './session';
import { signalerSalle } from './signal';
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
  /** S'est proposé comme capitaine : prioritaire au tirage de la régie. */
  volontaire = false,
): Promise<ResultatArrivee> {
  const { error } = await supabaseService().rpc('rejoindre_evenement', {
    p_code: code,
    p_prenom: prenom,
    p_langue: langue,
    p_jeton_hash: hacher(jeton),
    ...(groupe ? { p_groupe: groupe } : {}),
    p_volontaire: volontaire,
  });
  if (!error) return { ok: true };
  if (/complet/.test(error.message)) return { ok: false, erreur: 'complet' };
  if (/langue/.test(error.message)) return { ok: false, erreur: 'langue' };
  if (/groupe/.test(error.message)) return { ok: false, erreur: 'groupe' };
  if (/inconnu|expiré/.test(error.message)) return { ok: false, erreur: 'code_inconnu' };
  throw new Error(error.message);
}

export type ResultatAjout =
  | { ok: true; prenom: string; equipe: string | null }
  | { ok: false; erreur: 'session' | 'interdit' | 'complet' | 'groupe' | 'close' };

/**
 * Le joueur de ce cookie ajoute un invité sans téléphone. La base vérifie seule qu'il y est
 * autorisé (`peut_ajouter`, donné à la régie) ; l'équipe se tire comme à l'arrivée.
 */
export async function ajouterInvite(
  code: string,
  prenom: string,
  groupe: string | null,
): Promise<ResultatAjout> {
  const jeton = await jetonDe(code);
  const etat = jeton ? await etatPourJeton(code, jeton) : null;
  if (!jeton || !etat) return { ok: false, erreur: 'session' };

  const { data, error } = await supabaseService().rpc('ajouter_invite', {
    p_jeton_parrain: hacher(jeton),
    p_prenom: prenom,
    ...(groupe ? { p_groupe: groupe } : {}),
  });
  if (error) {
    if (/non autorisé/.test(error.message)) return { ok: false, erreur: 'interdit' };
    if (/complet/.test(error.message)) return { ok: false, erreur: 'complet' };
    if (/groupe/.test(error.message)) return { ok: false, erreur: 'groupe' };
    if (/clos/.test(error.message)) return { ok: false, erreur: 'close' };
    if (/session/.test(error.message)) return { ok: false, erreur: 'session' };
    throw new Error(error.message);
  }
  const ajout = data as { prenom: string; equipe: { nom: string } | null };
  return { ok: true, prenom: ajout.prenom, equipe: ajout.equipe?.nom ?? null };
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

/**
 * Mise du capitaine de ce cookie en mode jetons, enregistrée à chaque appel et validée quand
 * `valider`. La base décide seule (capitaine, question ouverte, chrono, déblocage, jetons) ;
 * l'écran et la régie sont prévenus aussitôt, les téléphones à leur relecture.
 */
export async function miserQuiz(
  code: string,
  repartition: number[],
  valider: boolean,
): Promise<{ ok: true; etat: EtatJoueur } | { ok: false; refus: RefusMise }> {
  const jeton = await jetonDe(code);
  const etat = jeton ? await etatPourJeton(code, jeton) : null;
  if (!jeton || !etat) return { ok: false, refus: 'session' };

  const { error } = await supabaseService().rpc('miser_quiz', {
    p_jeton_hash: hacher(jeton),
    p_repartition: repartition,
    p_valider: valider,
  });
  if (error) {
    const refus: RefusMise | null = /fermée/.test(error.message)
      ? 'fermee'
      : /pas capitaine/.test(error.message)
        ? 'capitaine'
        : /déjà/.test(error.message)
          ? 'deja'
          : /temps écoulé/.test(error.message)
            ? 'temps'
            : /invalide/.test(error.message)
              ? 'invalide'
              : /session/.test(error.message)
                ? 'session'
                : null;
    if (!refus) throw new Error(error.message);
    return { ok: false, refus };
  }
  await signalerSalle(etat.evenement.id, 'mises');
  return { ok: true, etat: (await etatPourJeton(code, jeton)) ?? etat };
}

export type RefusNom = 'session' | 'capitaine' | 'fige' | 'nom';

/**
 * Le capitaine de ce cookie renomme son équipe. La base décide seule (capitaine, nom figé par
 * la régie, 24 caractères au plus) ; renvoie l'état à jour pour l'afficher sans attendre.
 */
export async function renommerEquipe(
  code: string,
  nom: string,
): Promise<{ ok: true; etat: EtatJoueur } | { ok: false; refus: RefusNom }> {
  const jeton = await jetonDe(code);
  const etat = jeton ? await etatPourJeton(code, jeton) : null;
  if (!jeton || !etat) return { ok: false, refus: 'session' };

  const { error } = await supabaseService().rpc('renommer_equipe', {
    p_jeton_hash: hacher(jeton),
    p_nom: nom,
  });
  if (error) {
    const refus: RefusNom | null = /pas capitaine/.test(error.message)
      ? 'capitaine'
      : /figé/.test(error.message)
        ? 'fige'
        : /nom invalide/.test(error.message)
          ? 'nom'
          : /session/.test(error.message)
            ? 'session'
            : null;
    if (!refus) throw new Error(error.message);
    return { ok: false, refus };
  }
  // Aucun signal de régie ne couvre ce changement : l'écran commun le reçoit du serveur.
  await signalerSalle(etat.evenement.id);
  return { ok: true, etat: (await etatPourJeton(code, jeton)) ?? etat };
}
