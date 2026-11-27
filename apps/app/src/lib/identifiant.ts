/**
 * Un identifiant v4 tiré au hasard, dans le navigateur. `crypto.randomUUID` n'existe qu'en
 * contexte sécurisé (https ou localhost) : sur le PC de la salle servi en http par son adresse
 * (`TU_RESEAU_LOCAL`, une soirée sans internet), on le fabrique à partir de `getRandomValues`,
 * qui existe partout.
 */
export function identifiantAleatoire(
  source: Pick<Crypto, 'getRandomValues'> & { randomUUID?: () => string } = crypto,
): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID();
  const o = source.getRandomValues(new Uint8Array(16));
  o[6] = (o[6]! & 0x0f) | 0x40;
  o[8] = (o[8]! & 0x3f) | 0x80;
  const h = Array.from(o, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
