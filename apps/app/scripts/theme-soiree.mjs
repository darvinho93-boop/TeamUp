#!/usr/bin/env node
/**
 * Le thème d'une soirée sur l'écran commun (2026-11-27). Il ne s'active nulle part dans l'app :
 * ce script, avec la clé de service, dépose les fichiers des hôtes dans le bucket privé « themes »
 * et pose la ligne `themes_soiree` d'une soirée, ou la recopie sur une copie de cette soirée.
 * Les fichiers des hôtes restent hors du dépôt : le dossier source est donné en argument.
 *
 *   node scripts/theme-soiree.mjs --code PS4EPT --dossier "<dossier>"   dépose et pose le thème
 *   node scripts/theme-soiree.mjs --copier-de PS4EPT --vers ABC123      même thème sur une copie
 *   node scripts/theme-soiree.mjs --retirer ABC123                      retire le thème (pas les fichiers)
 *
 * Le dossier contient `theme.json` : { nom, theme, fichiers: { rôle: fichier }, reglages }, et les
 * fichiers qu'il nomme. Base : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY, à défaut celles de
 * `apps/app/.env.local` (la base locale).
 */
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const TYPES = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

const { values: options } = parseArgs({
  options: {
    code: { type: 'string' },
    dossier: { type: 'string' },
    'copier-de': { type: 'string' },
    vers: { type: 'string' },
    retirer: { type: 'string' },
  },
});

function variables() {
  try {
    const texte = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
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

const locales = variables();
const url = process.env.SUPABASE_URL ?? locales.SUPABASE_URL;
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY ?? locales.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !cle) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquent.');
  process.exit(1);
}
const base = createClient(url, cle, { auth: { persistSession: false } });
console.log('base :', new URL(url).host);

async function soiree(code) {
  const { data, error } = await base
    .from('evenements')
    .select('id, code')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (error || !data) throw new Error(`soirée introuvable : ${code}`);
  return data;
}

if (options.retirer) {
  const { id, code } = await soiree(options.retirer);
  const { error } = await base.from('themes_soiree').delete().eq('evenement_id', id);
  if (error) throw error;
  console.log(`thème retiré de ${code}`);
} else if (options['copier-de'] && options.vers) {
  const source = await soiree(options['copier-de']);
  const cible = await soiree(options.vers);
  const { data, error } = await base
    .from('themes_soiree')
    .select('theme, fichiers, reglages')
    .eq('evenement_id', source.id)
    .single();
  if (error) throw new Error(`${source.code} n'a pas de thème`);
  const pose = await base.from('themes_soiree').upsert({ evenement_id: cible.id, ...data });
  if (pose.error) throw pose.error;
  console.log(`thème de ${source.code} posé sur ${cible.code}`);
} else if (options.code && options.dossier) {
  const { id, code } = await soiree(options.code);
  const description = JSON.parse(readFileSync(join(options.dossier, 'theme.json'), 'utf8'));
  const fichiers = {};
  for (const [role, nom] of Object.entries(description.fichiers)) {
    const type = TYPES[extname(nom).toLowerCase()];
    if (!type) throw new Error(`type inconnu : ${nom}`);
    const chemin = `${description.nom}/${nom}`;
    const { error } = await base.storage
      .from('themes')
      .upload(chemin, readFileSync(join(options.dossier, nom)), {
        contentType: type,
        upsert: true,
      });
    if (error) throw new Error(`${nom} : ${error.message}`);
    fichiers[role] = chemin;
    console.log(`déposé : ${chemin}`);
  }
  const { error } = await base.from('themes_soiree').upsert({
    evenement_id: id,
    theme: description.theme,
    fichiers,
    reglages: description.reglages,
  });
  if (error) throw error;
  console.log(`thème « ${description.nom} » posé sur ${code}`);
} else {
  console.error('Voir l’en-tête du script pour les usages.');
  process.exit(1);
}
