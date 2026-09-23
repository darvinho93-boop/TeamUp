import 'server-only';

/** Réponse JSON jamais mise en cache : l'état d'une partie change à chaque instant. */
export function reponse(corps: unknown, status = 200): Response {
  return Response.json(corps, { status, headers: { 'Cache-Control': 'no-store' } });
}
