import 'server-only';

/** Au-delà, on n'attend plus la diffusion : le joueur a sa réponse, l'écran sa relecture de sûreté. */
const ATTENTE_MAX_MS = 2000;

/**
 * Le signal sans données de la régie (`relire` sur `salle:<id>`), envoyé cette fois par le
 * serveur : pour un changement qui vient d'un téléphone (un capitaine qui renomme son équipe),
 * que l'écran commun doit voir aussitôt. Passe par l'API de diffusion de Supabase, sans ouvrir
 * de canal. Au mieux : en cas d'échec, l'écran le verra à sa relecture de sûreté.
 *
 * `mises` (quiz en mode jetons, mots de la Surenchère en mode téléphones) n'est écouté que par
 * l'écran et la régie : chaque appui d'un capitaine ne fait pas relire les 150 téléphones, qui
 * n'écoutent que `relire`.
 */
export async function signalerSalle(
  evenementId: string,
  evenement: 'relire' | 'mises' = 'relire',
): Promise<void> {
  const url = process.env['SUPABASE_URL'];
  const cle = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !cle) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: cle, authorization: `Bearer ${cle}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ topic: `salle:${evenementId}`, event: evenement, payload: {} }],
      }),
      signal: AbortSignal.timeout(ATTENTE_MAX_MS),
    });
  } catch {
    // La relecture de sûreté de l'écran prend le relais.
  }
}
