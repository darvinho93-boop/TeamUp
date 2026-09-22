/**
 * Garde-fou « aucune valeur en dur » (CLAUDE.md, règles non négociables).
 *
 * Toute couleur, taille, espacement et rayon doit passer par un token. Ce script rend
 * la règle vérifiable : il échoue si une couleur littérale ou une dimension en pixels
 * apparaît ailleurs que dans les fichiers de tokens.
 *
 * Tolérances assumées : les épaisseurs de trait de 1 à 3 px (bordures, contours de focus)
 * et les points de rupture des media queries, qui n'ont pas d'équivalent en token.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const SCANNED = ['apps', join('packages', 'ui', 'src')];
const EXTENSIONS = new Set(['.css', '.astro', '.tsx', '.ts']);
const IGNORED_DIRS = new Set([
  'node_modules',
  '.next',
  '.astro',
  '.turbo',
  '.vercel',
  'dist',
  'out',
]);

/** Les seuls fichiers autorisés à porter des valeurs littérales. */
const TOKEN_FILES = [
  join('packages', 'ui', 'src', 'styles', 'tokens-layout.css'),
  join('design', 'brand', 'tokens.css'),
];

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const FUNCTIONAL_COLOR = /\b(?:rgba?|hsla?)\(/g;
const PIXELS = /(?<![\w-])(\d+(?:\.\d+)?)px/g;
const MAX_ALLOWED_PX = 3;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      yield full;
    }
  }
}

const problems = [];

for (const scanned of SCANNED) {
  // Pas de skip silencieux : un dossier introuvable est une erreur, pas un succès.
  const base = join(ROOT, scanned);
  statSync(base);

  for (const file of walk(base)) {
    const relativePath = relative(ROOT, file);
    if (TOKEN_FILES.includes(relativePath)) continue;

    const lines = readFileSync(file, 'utf8').split(/\r?\n/);

    lines.forEach((line, index) => {
      const report = (value, reason) => {
        problems.push(`${relativePath.split(sep).join('/')}:${index + 1}  ${value}  — ${reason}`);
      };

      for (const match of line.matchAll(HEX)) {
        report(match[0], 'couleur littérale : passer par un token (var(--tu-…))');
      }

      for (const match of line.matchAll(FUNCTIONAL_COLOR)) {
        report(match[0], 'couleur littérale : passer par un token (var(--tu-…))');
      }

      if (line.includes('@media')) return;

      for (const match of line.matchAll(PIXELS)) {
        if (Number(match[1]) > MAX_ALLOWED_PX) {
          report(match[0], 'dimension en dur : passer par un token d\u2019espacement ou de taille');
        }
      }
    });
  }
}

if (problems.length > 0) {
  console.error(`\nValeurs en dur détectées (${problems.length}) :\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('\nCorrige-les ou ajoute la valeur aux tokens.\n');
  process.exit(1);
}

console.log('check-tokens : aucune valeur en dur.');
