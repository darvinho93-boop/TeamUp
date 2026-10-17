import 'server-only';

/**
 * Le signal sans données de la régie (`relire` sur `salle:<id>`), envoyé cette fois par le
 * serveur : pour un changement qui vient d'un téléphone (un capitaine qui renomme son équipe),
 * que l'écran commun doit voir aussitôt. Passe par l'API de diffusion de Supabase, sans ouvrir
 * de canal. Au mieux : en cas d'échec, l'écran le verra à sa relecture de sûreté.
 */
export async function signalerSalle(evenementId: string): Promise<void> {
  const url = process.env['SUPABASE_URL'];
  const cle = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !cle) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: cle, authorization: `Bearer ${cle}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messages: [{ topic: `salle:${evenementId}`, event: 'relire', payload: {} }],
      }),
    });
  } catch {
    // La relecture de sûreté de l'écran prend le relais.
  }
}
