/**
 * L'illustration d'un thème (la mairie du faire-part) arrive en SVG du bucket « themes » et se
 * dessine trait par trait : elle est insérée dans la page, pas affichée comme une image. Avant,
 * elle est nettoyée : ne restent que les formes et leurs dégradés, sans script, sans objet
 * étranger, sans gestionnaire d'évènement ni lien sortant. Puis chaque trait reçoit de quoi se
 * dessiner (`pathLength` à 1 et sa part du dessin, de 0 à 1, dans l'ordre du fichier), et les
 * pointillés de quoi paraître ensuite.
 */

const BALISES = new Set([
  'svg',
  'g',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'pattern',
  'clippath',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
]);

const FORMES = 'path,rect,line,polyline,polygon,circle,ellipse';

/** Une valeur qui mène hors du document : un lien, une adresse, un script. */
function sortante(valeur: string): boolean {
  const v = valeur.trim().toLowerCase();
  if (v.includes('javascript:') || v.includes('data:') || v.includes('http')) return true;
  // `url(#degrade)` reste : c'est un renvoi interne au dessin.
  return /url\(\s*(?!['"]?#)/.test(v);
}

/** Le SVG nettoyé et prêt à se dessiner, en texte ; `null` s'il n'est pas lisible. */
export function illustrationDe(texte: string): string | null {
  const doc = new DOMParser().parseFromString(texte, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) return null;

  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) {
    if (!BALISES.has(el.localName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const attribut of Array.from(el.attributes)) {
      const nom = attribut.name.toLowerCase();
      const lien = nom === 'href' || nom.endsWith(':href');
      if (
        nom.startsWith('on') ||
        (lien && !attribut.value.trim().startsWith('#')) ||
        (!lien && sortante(attribut.value))
      )
        el.removeAttribute(attribut.name);
    }
  }

  const traits: Element[] = [];
  for (const forme of Array.from(svg.querySelectorAll(FORMES))) {
    if (forme.closest('defs, pattern, clipPath')) continue;
    const trait = forme.getAttribute('stroke') ?? forme.closest('[stroke]')?.getAttribute('stroke');
    if (!trait || trait === 'none') continue;
    if (forme.getAttribute('stroke-dasharray') || forme.closest('[stroke-dasharray]')) {
      forme.classList.add('tu-fp-pointille');
      continue;
    }
    forme.setAttribute('pathLength', '1');
    forme.classList.add('tu-fp-trace');
    traits.push(forme);
  }
  traits.forEach((forme, rang) => {
    const part = Math.round((rang / Math.max(1, traits.length - 1)) * 1000) / 1000;
    const style = forme.getAttribute('style');
    forme.setAttribute('style', `${style ? `${style};` : ''}--tu-fp-part: ${part}`);
  });
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true');
  return new XMLSerializer().serializeToString(svg);
}
