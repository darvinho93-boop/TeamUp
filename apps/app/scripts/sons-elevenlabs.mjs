/**
 * Les sons de l'écran commun, générés par ElevenLabs (effets sonores à partir d'une
 * description), puis recalés ici : silence coupé au début et à la fin, niveau aligné, fin sans
 * clic. Registre « jeu télé festif » (décision du 2026-10-09 : les sons synthétisés par
 * `sons.mjs` sonnaient trop artificiels).
 *
 *   node scripts/sons-elevenlabs.mjs [--seulement nom,nom] [--variantes a,b]
 *
 * La clé se lit dans ELEVENLABS_API_KEY ou dans le `.env` de la racine ; elle n'est jamais
 * affichée. Chaque génération consomme des crédits : le son brut est gardé dans
 * `scripts/sons-bruts/` et n'est pas redemandé s'il y est déjà. Supprimer un fichier brut pour
 * le régénérer.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const BRUTS = path.join(ici, 'sons-bruts');
const SORTIE = path.join(ici, '..', 'public', 'sons');
const FREQUENCE = 44100;

/** Ce qu'on demande : la description, la durée, et à quel point s'y tenir (0 à 1). */
const DEMANDES = {
  tic: {
    texte: 'A single dry wooden clock tick, close microphone, no reverb, no music',
    duree: 0.5,
    fidelite: 0.8,
    crete: 0.7,
  },
  tac: {
    texte:
      'A single dry wooden clock tock, slightly lower pitch than a tick, close microphone, no reverb, no music',
    duree: 0.5,
    fidelite: 0.8,
    crete: 0.7,
  },
  'fin-de-temps': {
    texte: 'TV game show time is up buzzer, short and punchy, studio sound, no voice',
    duree: 1.5,
    fidelite: 0.7,
  },
  indice: {
    texte:
      'Bright two-note ascending marimba and bell chime, a friendly game show hint notification, no voice',
    duree: 1.5,
    fidelite: 0.6,
  },
  reussite: {
    texte:
      'TV game show correct answer: short triumphant brass sting with a bell ding and a brief audience cheer, no voice',
    duree: 2.5,
    fidelite: 0.6,
  },
  echec: {
    texte: 'TV game show wrong answer: comedic descending trombone wah wah wah, short, no voice',
    duree: 2,
    fidelite: 0.7,
  },
  revelation: {
    texte:
      'A quick rising harp glissando ending on a bright bell, a magical reveal sting, no voice',
    duree: 1.5,
    fidelite: 0.6,
  },
  jingle: {
    texte:
      'Very short upbeat big band TV game show sting: brass hit with a cymbal crash, energetic, no voice',
    duree: 2,
    fidelite: 0.6,
  },
  'roulement-caisse': {
    texte:
      'A continuous snare drum roll steadily building in intensity, suspense, no cymbal, no ending hit, no music',
    duree: 5.5,
    fidelite: 0.8,
  },
  'roulement-cymbale': {
    texte: 'A big cymbal crash with a short orchestral brass hit, ta-da, no voice',
    duree: 2,
    fidelite: 0.7,
  },
  fanfare: {
    texte:
      'Triumphant big band TV game show winner fanfare with brass, drums and audience applause, clear final chord, no voice',
    duree: 7,
    fidelite: 0.5,
  },
  arrivee: {
    texte: 'A soft pleasant single pop chime, a gentle notification, very short, no voice',
    duree: 0.6,
    fidelite: 0.7,
    crete: 0.6,
  },
  ambiance: {
    texte:
      'Light upbeat lounge jazz waiting music for a TV game show: vibraphone, upright bass and brushes, cheerful, instrumental, seamless loop',
    duree: 22,
    fidelite: 0.4,
    boucle: true,
    crete: 0.7,
  },
  explication: {
    texte:
      'Light playful background music for explaining the rules of a party game: pizzicato strings, marimba and soft shaker, upbeat but calm, instrumental, no melody that distracts, seamless loop',
    duree: 22,
    fidelite: 0.4,
    boucle: true,
    crete: 0.7,
  },
};

/** Durée de l'interlude entre deux jeux (`INTERLUDE_MS`, dans `src/lib/sons.ts`). */
const INTERLUDE_S = 1.6;

const option = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i > 0 ? process.argv[i + 1].split(',') : defaut;
};
const seulement = option('seulement', Object.keys(DEMANDES));
const variantes = option('variantes', ['a', 'b']);

function cle() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const env = path.join(ici, '..', '..', '..', '.env');
  const trouvee = existsSync(env) && readFileSync(env, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m);
  if (!trouvee)
    throw new Error('ELEVENLABS_API_KEY introuvable (environnement ou .env de la racine).');
  return trouvee[1].trim();
}

/** Demande un son en PCM 16 bits à 44,1 kHz : de quoi le retoucher ici sans décodeur. */
async function generer(nom, demande) {
  const reponse = await fetch(
    'https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_44100',
    {
      method: 'POST',
      headers: { 'xi-api-key': cle(), 'content-type': 'application/json' },
      body: JSON.stringify({
        text: demande.texte,
        duration_seconds: demande.duree,
        prompt_influence: demande.fidelite,
        model_id: 'eleven_text_to_sound_v2',
        ...(demande.boucle ? { loop: true } : {}),
      }),
    },
  );
  if (!reponse.ok) {
    const detail = (await reponse.text()).slice(0, 400);
    throw new Error(`ElevenLabs a refusé « ${nom} » : ${reponse.status} ${detail}`);
  }
  return Buffer.from(await reponse.arrayBuffer());
}

/**
 * PCM 16 bits stéréo entrelacé (c'est ce qu'ElevenLabs renvoie, vérifié sur la taille des
 * fichiers) → échantillons mono entre -1 et 1. L'écran commun joue en mono.
 */
function lire(pcm) {
  const son = new Float32Array(Math.floor(pcm.length / 4));
  for (let i = 0; i < son.length; i += 1)
    son[i] = (pcm.readInt16LE(i * 4) + pcm.readInt16LE(i * 4 + 2)) / 65536;
  return son;
}

/**
 * Recale un son : il doit partir à l'instant où on le déclenche, donc on coupe le silence du
 * début (en gardant 3 ms pour l'attaque), puis celui de la fin, et on finit sans clic. Une
 * boucle, elle, ne se coupe pas : elle se referme sur elle-même telle quelle.
 */
function recaler(son, { crete = 0.85, boucle = false } = {}) {
  let max = 0;
  for (const v of son) max = Math.max(max, Math.abs(v));
  if (max === 0) throw new Error('son vide');
  let debut = 0;
  let fin = son.length;
  if (!boucle) {
    const seuil = max * 0.02;
    while (debut < son.length && Math.abs(son[debut]) < seuil) debut += 1;
    debut = Math.max(0, debut - Math.round(0.003 * FREQUENCE));
    while (fin > debut && Math.abs(son[fin - 1]) < seuil / 2) fin -= 1;
    fin = Math.min(son.length, fin + Math.round(0.05 * FREQUENCE));
  }
  const sortie = Float32Array.from(son.subarray(debut, fin));
  const fondu = Math.round(0.04 * FREQUENCE);
  for (let i = 0; i < sortie.length; i += 1) {
    const queue = boucle ? 1 : Math.min(1, (sortie.length - 1 - i) / fondu);
    const tete = boucle ? 1 : Math.min(1, i / 32);
    sortie[i] = (sortie[i] / max) * crete * queue * tete;
  }
  return { son: sortie, coupeAuDebutMs: Math.round((debut / FREQUENCE) * 1000) };
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

const niveauMoyen = (son) => {
  let carres = 0;
  for (const v of son) carres += v * v;
  return Math.sqrt(carres / son.length);
};

mkdirSync(BRUTS, { recursive: true });
mkdirSync(SORTIE, { recursive: true });

let generes = 0;
let secondes = 0;
const recales = new Map();
for (const variante of variantes) {
  for (const nom of seulement) {
    const demande = DEMANDES[nom];
    if (!demande) throw new Error(`son inconnu : ${nom}`);
    const brut = path.join(BRUTS, `${nom}-${variante}.pcm`);
    if (!existsSync(brut)) {
      writeFileSync(brut, await generer(nom, demande));
      generes += 1;
      secondes += demande.duree;
    }
    const { son, coupeAuDebutMs } = recaler(lire(readFileSync(brut)), demande);
    recales.set(`${nom}-${variante}`, son);
    console.log(
      `${`${nom}-${variante}`.padEnd(22)} ${(son.length / FREQUENCE).toFixed(2).padStart(5)} s  ` +
        `silence coupé au début ${String(coupeAuDebutMs).padStart(4)} ms  niveau moyen ${niveauMoyen(son).toFixed(3)}`,
    );
    if (!nom.startsWith('roulement-'))
      writeFileSync(path.join(SORTIE, `${nom}-${variante}.wav`), wav(son));
  }
  // Le roulement se monte ici : la caisse claire pendant 5 s exactement, puis la cymbale, pour
  // que le coup tombe quand l'écran a fini de ranger les équipes.
  const caisse = recales.get(`roulement-caisse-${variante}`);
  const cymbale = recales.get(`roulement-cymbale-${variante}`);
  if (caisse && cymbale) {
    const coup = 5 * FREQUENCE;
    const monte = new Float32Array(coup + cymbale.length);
    const sortieCaisse = Math.round(0.15 * FREQUENCE);
    for (let i = 0; i < Math.min(caisse.length, coup); i += 1)
      monte[i] = caisse[i] * Math.min(1, (coup - i) / sortieCaisse) * (0.45 + 0.55 * (i / coup));
    for (let i = 0; i < cymbale.length; i += 1) monte[coup + i] += cymbale[i];
    writeFileSync(path.join(SORTIE, `roulement-${variante}.wav`), wav(monte));

    // Le roulement de présentation : la fin du même roulement, qui enfle le temps de l'interlude
    // et s'arrête net pour laisser la place au jingle.
    const longueur = Math.round(INTERLUDE_S * FREQUENCE);
    const depart = Math.max(0, Math.min(caisse.length, coup) - longueur);
    const presentation = new Float32Array(longueur);
    const entree = Math.round(0.08 * FREQUENCE);
    const sortiePresentation = Math.round(0.05 * FREQUENCE);
    for (let i = 0; i < longueur && depart + i < caisse.length; i += 1)
      presentation[i] =
        caisse[depart + i] *
        Math.min(1, i / entree) *
        Math.min(1, (longueur - i) / sortiePresentation) *
        (0.5 + 0.5 * (i / longueur));
    // Ramené au niveau des autres sons : un extrait du roulement, pris seul, est trop discret.
    let cretePresentation = 0;
    for (const v of presentation) cretePresentation = Math.max(cretePresentation, Math.abs(v));
    for (let i = 0; i < longueur; i += 1) presentation[i] *= 0.85 / (cretePresentation || 1);
    writeFileSync(path.join(SORTIE, `presentation-${variante}.wav`), wav(presentation));
    console.log(
      `${`presentation-${variante}`.padEnd(22)} ${INTERLUDE_S.toFixed(2).padStart(5)} s  monté  niveau moyen ${niveauMoyen(presentation).toFixed(3)}`,
    );
    console.log(
      `${`roulement-${variante}`.padEnd(22)} ${(monte.length / FREQUENCE).toFixed(2).padStart(5)} s  monté (cymbale à 5,00 s)`,
    );
  }
}
console.log(
  `${generes} sons générés chez ElevenLabs (${secondes.toFixed(1)} s demandées), le reste repris de ${BRUTS}`,
);
