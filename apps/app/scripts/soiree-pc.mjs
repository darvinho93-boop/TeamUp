#!/usr/bin/env node
/**
 * Une soirée servie par ce PC, sans internet (2026-11-28, docs/soiree-sur-pc.md) : les téléphones
 * se branchent au wifi de la salle (le routeur), le PC y sert l'app en http.
 *
 *   pnpm soiree:pc --code PS4EPT                 l'adresse du PC sur le routeur (192.168.10.x)
 *   pnpm soiree:pc --code PS4EPT --ip 127.0.0.1  ce PC seul (une répétition sans routeur)
 *   … --reconstruire                             refait la version construite
 *
 * Avant de démarrer : la base locale répond et la soirée y est (`descendre-soiree.mjs`). La
 * version est construite une fois pour l'adresse (elle est écrite dans le code envoyé aux
 * navigateurs) et pour la version du code (refaite dès que le code a changé : un correctif
 * arrive donc jusqu'à la soirée), dans `.next-machine` : la version de développement et celle des
 * tests restent.
 * Puis l'app démarre sur le port 3000 de toutes les interfaces, cookie des joueurs en http
 * (`TU_RESEAU_LOCAL=1`). Ctrl+C l'arrête.
 */
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const APP = new URL('..', import.meta.url);
const DOSSIER = '.next-machine';
const PORT = 3000;
const RESEAU_DU_ROUTEUR = '192.168.10.';

const { values: options } = parseArgs({
  options: {
    code: { type: 'string' },
    ip: { type: 'string' },
    reconstruire: { type: 'boolean', default: false },
  },
});
const arreter = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};
if (!options.code) arreter('Usage : pnpm soiree:pc --code CODE [--ip ADRESSE] [--reconstruire]');
const CODE = options.code.toUpperCase();

// L'adresse du PC sur le routeur de la salle.
const adresses = Object.values(networkInterfaces())
  .flat()
  .filter((a) => a && a.family === 'IPv4' && !a.internal)
  .map((a) => a.address);
const ip = options.ip ?? adresses.find((a) => a.startsWith(RESEAU_DU_ROUTEUR));
if (!ip)
  arreter(
    `Le PC n'a pas d'adresse sur le routeur (${RESEAU_DU_ROUTEUR}x) : est-il branché au routeur ?\n` +
      `Adresses vues : ${adresses.join(', ') || 'aucune'}. Pour une répétition sur ce PC seul : --ip 127.0.0.1`,
  );

// La base locale et la soirée.
const env = Object.fromEntries(
  readFileSync(new URL('.env.local', APP), 'utf8')
    .split(/\r?\n/)
    .map((ligne) => ligne.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, cle, valeur]) => [cle, valeur.trim()]),
);
const base = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: soiree, error } = await base
  .from('evenements')
  .select('code, client_nom')
  .eq('code', CODE)
  .maybeSingle();
if (error)
  arreter(
    `La base locale ne répond pas (${error.message}).\nDocker Desktop est-il démarré ? Puis : pnpm db:start`,
  );
if (!soiree)
  arreter(
    `${CODE} n'est pas sur ce PC : node apps/app/scripts/descendre-soiree.mjs --code ${CODE}`,
  );

// La version construite pour cette adresse et ce code : le dernier commit, plus l'empreinte des
// modifications pas encore commitées de ce qui part dans l'app (sans git, l'adresse seule).
const git = (args) =>
  execFileSync('git', args, { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const versionDuCode = (() => {
  try {
    const chemins = ['.', '../../packages', '../../design'];
    const enCours =
      git(['diff', 'HEAD', '--', ...chemins]) +
      git(['ls-files', '--others', '--exclude-standard', '--', 'src', '../../packages']);
    const commit = git(['rev-parse', 'HEAD']).trim();
    return enCours
      ? `${commit}+${createHash('sha256').update(enCours).digest('hex').slice(0, 12)}`
      : commit;
  } catch {
    return null;
  }
})();
const voulue = [ip, versionDuCode].filter(Boolean).join(' ');
const marque = new URL(`${DOSSIER}/tu-adresse.txt`, APP);
const construitePour = existsSync(marque) ? readFileSync(marque, 'utf8').trim() : null;
const pnpm = (args, envSup) =>
  execFileSync('pnpm', args, {
    cwd: APP,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TU_DIST_DIR: DOSSIER, ...envSup },
  });
if (options.reconstruire || construitePour !== voulue) {
  console.log(
    construitePour?.split(' ')[0] === ip
      ? `Le code a changé depuis la dernière construction : construction de l'app (quelques minutes)…`
      : `Construction de l'app pour http://${ip}:${PORT} (quelques minutes)…`,
  );
  pnpm(['exec', 'next', 'build'], {
    NEXT_PUBLIC_SUPABASE_URL: `http://${ip}:54321`,
    NEXT_PUBLIC_APP_URL: `http://${ip}:${PORT}`,
  });
  writeFileSync(marque, voulue);
}

console.log(`
${CODE} (${soiree.client_nom}), servie par ce PC :
  écran  : http://localhost:${PORT}/ecran/${CODE}   (sur ce PC, en plein écran)
  régie  : http://localhost:${PORT}/regie           (ou http://${ip}:${PORT}/regie depuis le wifi)
  invités: http://${ip}:${PORT}/${CODE}             (le QR de l'écran y mène)
Ctrl+C arrête l'app.
`);
const app = spawn('pnpm', ['exec', 'next', 'start', '-H', '0.0.0.0', '-p', String(PORT)], {
  cwd: APP,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, TU_DIST_DIR: DOSSIER, TU_RESEAU_LOCAL: '1' },
});
app.on('exit', (code) => process.exit(code ?? 0));
