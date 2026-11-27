#!/usr/bin/env node
/**
 * Descend une soirée de l'en-ligne vers la base de ce PC (2026-11-28), pour la jouer sans
 * internet : le PC sert l'app sur le wifi de la salle (`pnpm soiree:pc`, docs/soiree-sur-pc.md).
 *
 *   node scripts/descendre-soiree.mjs --code PS4EPT                  copie (ou refait la copie)
 *   node scripts/descendre-soiree.mjs --code PS4EPT --remise-a-zero  même si elle a été jouée sur le PC
 *
 * L'en-ligne n'est que LU. Source : SOURCE_SUPABASE_URL et SOURCE_SERVICE_ROLE_KEY, à défaut le
 * projet lié par la CLI Supabase (`supabase/.temp/project-ref`), dont la clé de service est
 * demandée à la CLI et gardée en mémoire. Cible : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, à
 * défaut `apps/app/.env.local` (la base locale) ; une cible en ligne est refusée.
 *
 * Recopié avec les mêmes identifiants (les deux bases ont les mêmes migrations) : le compte de
 * l'animateur (créé sur le PC avec un mot de passe tiré au hasard, donné une fois), la soirée,
 * son pilotage, ses groupes et équipes, ses contenus et ceux de la banque qu'elle utilise, ses
 * musiques, son programme, son thème, et leurs fichiers. Jamais les joueurs : les invités
 * s'inscrivent le soir même, sur le wifi du PC. Une copie déjà jouée sur le PC (joueurs ou
 * points) n'est remplacée qu'avec `--remise-a-zero`.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const RACINE = new URL('../../../', import.meta.url);
const { values: options } = parseArgs({
  options: { code: { type: 'string' }, 'remise-a-zero': { type: 'boolean', default: false } },
});
if (!options.code) {
  console.error('Usage : node scripts/descendre-soiree.mjs --code CODE [--remise-a-zero]');
  process.exit(1);
}
const CODE = options.code.toUpperCase();

const TYPES = {
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function variablesLocales() {
  try {
    const texte = readFileSync(new URL('apps/app/.env.local', RACINE), 'utf8');
    return Object.fromEntries(
      texte
        .split(/\r?\n/)
        .map((ligne) => ligne.match(/^([A-Z_]+)=(.*)$/))
        .filter(Boolean)
        .map(([, cle, valeur]) => [cle, valeur.trim()]),
    );
  } catch {
    return {};
  }
}

/** La source : l'en-ligne. Sa clé de service vient de la CLI, jamais d'un fichier. */
function accesSource() {
  if (process.env.SOURCE_SUPABASE_URL && process.env.SOURCE_SERVICE_ROLE_KEY)
    return { url: process.env.SOURCE_SUPABASE_URL, cle: process.env.SOURCE_SERVICE_ROLE_KEY };
  const ref = readFileSync(new URL('supabase/.temp/project-ref', RACINE), 'utf8').trim();
  const sortie = execFileSync(
    'pnpm',
    ['exec', 'supabase', 'projects', 'api-keys', '--project-ref', ref, '-o', 'json'],
    { cwd: RACINE, encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const cle = JSON.parse(sortie).find((k) => k.name === 'service_role')?.api_key;
  if (!cle) throw new Error('clé de service introuvable (la CLI Supabase est-elle connectée ?)');
  return { url: `https://${ref}.supabase.co`, cle };
}

const locales = variablesLocales();
const cible = {
  url: process.env.SUPABASE_URL ?? locales.SUPABASE_URL,
  cle: process.env.SUPABASE_SERVICE_ROLE_KEY ?? locales.SUPABASE_SERVICE_ROLE_KEY,
};
if (!cible.url || !cible.cle) throw new Error('base du PC introuvable (apps/app/.env.local)');
const hoteCible = new URL(cible.url).hostname;
if (hoteCible.endsWith('supabase.co') || hoteCible.endsWith('supabase.com'))
  throw new Error(`cible refusée : ${hoteCible} est une base en ligne`);
const source = accesSource();
if (new URL(source.url).hostname === hoteCible)
  throw new Error('la source et la cible sont la même base');

const options_ = { auth: { persistSession: false } };
const enLigne = createClient(source.url, source.cle, options_);
const pc = createClient(cible.url, cible.cle, options_);
console.log(`source : ${new URL(source.url).hostname} (lecture seule)\ncible  : ${hoteCible}\n`);

const ok = (resultat, quoi) => {
  if (resultat.error) throw new Error(`${quoi} : ${resultat.error.message}`);
  return resultat.data;
};
const lire = async (table, colonne, valeurs) =>
  valeurs.length === 0
    ? []
    : ok(await enLigne.from(table).select('*').in(colonne, valeurs), `lecture ${table}`);
const ecrire = async (table, lignes, conflit) => {
  if (lignes.length === 0) return;
  ok(await pc.from(table).upsert(lignes, { onConflict: conflit }), `écriture ${table}`);
};

// ---------------------------------------------------------------- la soirée en ligne
const soiree = ok(
  await enLigne.from('evenements').select('*').eq('code', CODE).maybeSingle(),
  'lecture de la soirée',
);
if (!soiree) throw new Error(`soirée introuvable en ligne : ${CODE}`);
const pilotage = ok(
  await enLigne.from('pilotage').select('*').eq('evenement_id', soiree.id).single(),
  'lecture du pilotage',
);
const groupes = await lire('groupes', 'evenement_id', [soiree.id]);
const equipes = await lire('equipes', 'evenement_id', [soiree.id]);
const equipesGroupes = await lire(
  'equipes_groupes',
  'equipe_id',
  equipes.map((e) => e.id),
);
const manches = await lire('manches', 'evenement_id', [soiree.id]);
const passages = await lire('passages', 'evenement_id', [soiree.id]);
const grilles = await lire(
  'grilles_portrait',
  'manche_id',
  manches.map((m) => m.id),
);
const themes = await lire('themes_soiree', 'evenement_id', [soiree.id]);

// Les contenus et les musiques : ceux de la soirée, et tout identifiant que son programme cite
// (réserves, thèmes, titres du Blind test, musiques des chronos, grille du Portrait mystère).
const cites = new Set();
const ramasser = (valeur) => {
  if (typeof valeur === 'string' && UUID.test(valeur)) cites.add(valeur);
  else if (Array.isArray(valeur)) valeur.forEach(ramasser);
  else if (valeur && typeof valeur === 'object') Object.values(valeur).forEach(ramasser);
};
manches.forEach((m) => ramasser(m.options));
passages.forEach((p) => ramasser(p.contenu_id));
grilles.forEach((g) => ramasser(g.cartes));
const proches = await lire('contenus', 'evenement_id', [soiree.id]);
const deLaBanque = await lire('contenus', 'id', [...cites]);
const contenus = [...new Map([...proches, ...deLaBanque].map((c) => [c.id, c])).values()];
const idsContenus = contenus.map((c) => c.id);
const traductions = await lire('contenus_traductions', 'contenu_id', idsContenus);
const secrets = await lire('contenus_secrets', 'contenu_id', idsContenus);
const musiques = await lire('musiques', 'id', [...cites]);

const animateur = ok(
  await enLigne.from('animateurs').select('*').eq('id', soiree.animateur_id).single(),
  "lecture de l'animateur",
);
const compte = ok(
  await enLigne.auth.admin.getUserById(soiree.animateur_id),
  'lecture du compte',
).user;

console.log(
  `${CODE} : ${manches.length} jeux, ${passages.length} passages, ${contenus.length} contenus, ` +
    `${musiques.length} musiques, ${themes.length ? 'un thème' : 'sans thème'}` +
    (equipes.length ? `, ${equipes.length} équipes` : ''),
);

// ---------------------------------------------------------------- la copie sur le PC
const surPC = ok(
  await pc.from('evenements').select('id, code').or(`id.eq.${soiree.id},code.eq.${CODE}`),
  'lecture de la copie',
);
for (const ancienne of surPC) {
  const { count: nJoueurs } = await pc
    .from('joueurs')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', ancienne.id);
  const { count: nPoints } = await pc
    .from('scores')
    .select('*', { count: 'exact', head: true })
    .eq('evenement_id', ancienne.id);
  if ((nJoueurs || nPoints) && !options['remise-a-zero']) {
    console.error(
      `La copie de ${CODE} sur ce PC a été jouée (${nJoueurs ?? 0} joueurs, ${nPoints ?? 0} points) : ` +
        'relancer avec --remise-a-zero pour la remplacer.',
    );
    process.exit(1);
  }
  // Repartir d'une copie neuve : tout ce qui dépend de la soirée part avec elle (cascade).
  ok(await pc.from('evenements').delete().eq('id', ancienne.id), "suppression de l'ancienne copie");
  console.log(`ancienne copie retirée (${nJoueurs ?? 0} joueurs, ${nPoints ?? 0} points)`);
}

// Le compte de l'animateur : même identifiant, même e-mail.
const existant = await pc.auth.admin.getUserById(compte.id);
if (existant.data?.user) {
  console.log(`compte sur le PC : ${compte.email} (déjà là, mot de passe inchangé)`);
} else {
  const motDePasse = randomBytes(9).toString('base64url');
  ok(
    await pc.auth.admin.createUser({
      id: compte.id,
      email: compte.email,
      password: motDePasse,
      email_confirm: true,
    }),
    'création du compte',
  );
  console.log(
    `compte créé sur le PC : ${compte.email}\n  mot de passe : ${motDePasse}  (à noter ; à changer dans « Mon compte »)`,
  );
}
await ecrire('animateurs', [animateur], 'id');

await ecrire('evenements', [soiree], 'id');
// La base crée le pilotage avec la soirée ; il prend celui d'en ligne une fois le programme posé.
await ecrire('groupes', groupes, 'id');
await ecrire('equipes', equipes, 'id');
await ecrire('equipes_groupes', equipesGroupes, 'equipe_id,groupe_id');
const auteurConnu = (c) => (c.cree_par === animateur.id ? c : { ...c, cree_par: null });
await ecrire('contenus', contenus.map(auteurConnu), 'id');
await ecrire('contenus_traductions', traductions, 'contenu_id,langue');
await ecrire('contenus_secrets', secrets, 'contenu_id,langue');
await ecrire('musiques', musiques, 'id');
await ecrire('manches', manches, 'id');
await ecrire(
  'passages',
  passages.map((p) => ({ ...p, joueur_designe_id: null })),
  'id',
);
await ecrire('grilles_portrait', grilles, 'manche_id');
await ecrire('themes_soiree', themes, 'evenement_id');
await ecrire('pilotage', [pilotage], 'evenement_id');

// ---------------------------------------------------------------- les fichiers
const fichiers = [
  ...musiques.map((m) => ['musiques', m.chemin]),
  ...contenus.filter((c) => c.extrait).map((c) => ['extraits', c.extrait]),
  ...manches.filter((m) => m.fond).map((m) => ['fonds', m.fond]),
  ...(soiree.logo_partenaire ? [['logos', soiree.logo_partenaire]] : []),
  ...themes.flatMap((t) =>
    Object.values(t.fichiers ?? {})
      .filter((chemin) => typeof chemin === 'string')
      .map((chemin) => ['themes', chemin]),
  ),
];

/** La taille d'un fichier d'un bucket, ou `null` s'il n'y est pas. */
async function taille(client, bucket, chemin) {
  const i = chemin.lastIndexOf('/');
  const dossier = i < 0 ? '' : chemin.slice(0, i);
  const nom = chemin.slice(i + 1);
  const { data } = await client.storage.from(bucket).list(dossier, { search: nom, limit: 100 });
  const trouve = (data ?? []).find((f) => f.name === nom);
  return trouve ? Number(trouve.metadata?.size ?? -1) : null;
}

let copies = 0;
let deja = 0;
let octets = 0;
const ecarts = [];
for (const [bucket, chemin] of fichiers) {
  const tailleEnLigne = await taille(enLigne, bucket, chemin);
  if (tailleEnLigne === null) {
    ecarts.push(`${bucket}/${chemin} : absent en ligne`);
    continue;
  }
  if ((await taille(pc, bucket, chemin)) === tailleEnLigne) {
    deja++;
    continue;
  }
  const blob = ok(await enLigne.storage.from(bucket).download(chemin), `téléchargement ${chemin}`);
  const contenu = Buffer.from(await blob.arrayBuffer());
  const type = TYPES[extname(chemin).toLowerCase()] ?? blob.type;
  ok(
    await pc.storage.from(bucket).upload(chemin, contenu, { contentType: type, upsert: true }),
    `dépôt ${bucket}/${chemin}`,
  );
  copies++;
  octets += contenu.length;
  process.stdout.write(`  ${bucket}/${chemin} (${(contenu.length / 1048576).toFixed(1)} Mo)\n`);
}
console.log(
  `fichiers : ${copies} copiés (${(octets / 1048576).toFixed(1)} Mo), ${deja} déjà à jour sur le PC`,
);

// ---------------------------------------------------------------- la vérification
const compter = async (client, table, colonne, valeurs) => {
  if (valeurs.length === 0) return 0;
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .in(colonne, valeurs);
  if (error) throw new Error(`comptage ${table} : ${error.message}`);
  return count ?? 0;
};
const controles = [
  ['manches', 'evenement_id', [soiree.id]],
  ['passages', 'evenement_id', [soiree.id]],
  ['groupes', 'evenement_id', [soiree.id]],
  ['equipes', 'evenement_id', [soiree.id]],
  ['contenus', 'id', idsContenus],
  ['contenus_traductions', 'contenu_id', idsContenus],
  ['contenus_secrets', 'contenu_id', idsContenus],
  ['musiques', 'id', musiques.map((m) => m.id)],
  ['themes_soiree', 'evenement_id', [soiree.id]],
];
for (const [table, colonne, valeurs] of controles) {
  const [a, b] = [
    await compter(enLigne, table, colonne, valeurs),
    await compter(pc, table, colonne, valeurs),
  ];
  if (a !== b) ecarts.push(`${table} : ${a} en ligne, ${b} sur le PC`);
}
for (const [bucket, chemin] of fichiers) {
  const [a, b] = [await taille(enLigne, bucket, chemin), await taille(pc, bucket, chemin)];
  if (a !== b) ecarts.push(`${bucket}/${chemin} : ${a} octets en ligne, ${b} sur le PC`);
}
if (ecarts.length) {
  console.error(`\nÉCARTS :\n  ${ecarts.join('\n  ')}`);
  process.exit(1);
}
console.log(`\n${CODE} est sur le PC, à l'identique (lignes et fichiers vérifiés).`);
