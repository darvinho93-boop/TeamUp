/**
 * Le son de la passe finale de l'ouverture (décision du 2026-10-18) : la piste du reel Team Up!
 * (`teamup_reel.mp4`, 6,5 s : un silence, une montée, un coup quand le logo se forme), à la place
 * du roulement et du jingle. Le script la recale comme les autres sons : silence coupé au début
 * et à la fin, crête à 0,85, fin sans clic ; il dit où tombe le coup, qui doit rester égal à
 * `COUP_FINALE_MS` (`src/lib/sons.ts`, testé).
 *
 * D'abord décoder la vidéo en WAV mono à 44,1 kHz avec le ffmpeg du projet vidéo, depuis `video/` :
 *   pnpm exec remotion ffmpeg -i "<teamup_reel.mp4>" -vn -ac 1 -ar 44100
 *     -c:a pcm_s16le ../apps/app/scripts/sons-bruts/finale-reel.wav
 * puis, depuis la racine :
 *   node apps/app/scripts/son-finale.mjs apps/app/scripts/sons-bruts/finale-reel.wav
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ici, '..', 'public', 'sons', 'finale.wav');
const FREQUENCE = 44100;
const CRETE = 0.85;
const SEUIL_DB = -60;

const source = process.argv[2];
if (!source) {
  console.error('Usage : node scripts/son-finale.mjs <piste du reel, WAV mono 44,1 kHz>');
  process.exit(1);
}

/** Les échantillons d'un WAV PCM 16 bits mono à 44,1 kHz, entre -1 et 1. */
function lire(fichier) {
  const octets = readFileSync(fichier);
  if (octets.toString('ascii', 0, 4) !== 'RIFF') throw new Error('pas un fichier WAV');
  let i = 12;
  let format = null;
  while (i + 8 <= octets.length) {
    const nom = octets.toString('ascii', i, i + 4);
    const taille = octets.readUInt32LE(i + 4);
    if (nom === 'fmt ') {
      format = {
        canaux: octets.readUInt16LE(i + 10),
        frequence: octets.readUInt32LE(i + 12),
        bits: octets.readUInt16LE(i + 22),
      };
    } else if (nom === 'data') {
      if (!format || format.canaux !== 1 || format.frequence !== FREQUENCE || format.bits !== 16) {
        throw new Error('attendu : WAV PCM 16 bits, mono, 44,1 kHz (voir la commande ffmpeg)');
      }
      const son = new Float32Array(taille / 2);
      for (let j = 0; j < son.length; j += 1) son[j] = octets.readInt16LE(i + 8 + j * 2) / 32768;
      return son;
    }
    i += 8 + taille + (taille % 2);
  }
  throw new Error('aucune donnée audio');
}

function wav(son) {
  const pcm = Buffer.alloc(son.length * 2);
  for (let i = 0; i < son.length; i += 1)
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, son[i])) * 32767), i * 2);
  const entete = Buffer.alloc(44);
  entete.write('RIFF', 0);
  entete.writeUInt32LE(36 + pcm.length, 4);
  entete.write('WAVEfmt ', 8);
  entete.writeUInt32LE(16, 16);
  entete.writeUInt16LE(1, 20);
  entete.writeUInt16LE(1, 22);
  entete.writeUInt32LE(FREQUENCE, 24);
  entete.writeUInt32LE(FREQUENCE * 2, 28);
  entete.writeUInt16LE(2, 32);
  entete.writeUInt16LE(16, 34);
  entete.write('data', 36);
  entete.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([entete, pcm]);
}

const brut = lire(source);

// Le niveau par fenêtres de 10 ms : où le son devient audible, où il s'éteint.
const fenetre = Math.round(0.01 * FREQUENCE);
const seuil = 10 ** (SEUIL_DB / 20);
const audibles = [];
for (let i = 0; i + fenetre <= brut.length; i += fenetre) {
  let carres = 0;
  for (let j = i; j < i + fenetre; j += 1) carres += brut[j] * brut[j];
  if (Math.sqrt(carres / fenetre) > seuil) audibles.push(i);
}
if (!audibles.length) throw new Error('piste silencieuse');
const debut = Math.max(0, audibles[0] - Math.round(0.25 * FREQUENCE));
const fin = Math.min(brut.length, audibles.at(-1) + fenetre + Math.round(0.1 * FREQUENCE));
const son = brut.slice(debut, fin);

// Crête à 0,85 comme les autres sons, et 50 ms d'extinction : pas de clic à la fin.
let crete = 0;
let coup = 0;
for (let i = 0; i < son.length; i += 1) {
  if (Math.abs(son[i]) > crete) {
    crete = Math.abs(son[i]);
    coup = i;
  }
}
const extinction = Math.round(0.05 * FREQUENCE);
for (let i = 0; i < son.length; i += 1) {
  son[i] *= (CRETE / (crete || 1)) * Math.min(1, (son.length - i) / extinction);
}

writeFileSync(SORTIE, wav(son));
console.log(
  `finale.wav  ${(son.length / FREQUENCE).toFixed(2)} s  silence coupé au début ` +
    `${Math.round((debut / FREQUENCE) * 1000)} ms  coup à ${Math.round((coup / FREQUENCE) * 1000)} ms ` +
    '(à reporter dans COUP_FINALE_MS)',
);
