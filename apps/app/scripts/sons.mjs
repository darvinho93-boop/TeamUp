/**
 * Les sons de l'écran commun, entièrement fabriqués ici : mêmes instruments que le générique
 * du teaser (cuivres, carillon, basse, orgue, percussions, petite salle), pour que la soirée
 * sonne comme la vidéo qui l'annonce. Aucun fichier tiers : même le tic-tac est synthétisé.
 *
 *   pnpm --filter @teamup/app sons     → apps/app/public/sons/*.wav (versionnés)
 *
 * Composés à l'aveugle, puis jugés à l'oreille sur /kit-ui/sons : retoucher une partition
 * ici, relancer, réécouter. Le hasard est reproductible : deux fabrications donnent les mêmes
 * fichiers.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FREQUENCE = 44100;
/** 150 à la noire, comme le générique : un temps dure 0,4 s. */
const TEMPS = 0.4;
/** Le contretemps du swing : la croche « en l'air » tombe aux deux tiers du temps. */
const SWING = 2 / 3;

const rang = (secondes) => Math.round(secondes * FREQUENCE);
const hz = (note) => 440 * 2 ** ((note - 69) / 12);

let graine = 20261009;
const alea = () => {
  graine = (graine * 1664525 + 1013904223) >>> 0;
  return graine / 4294967296;
};
const bruit = () => alea() * 2 - 1;

/* ---------- Filtres ---------- */

/** Filtre du second ordre (formules de Robert Bristow-Johnson), appliqué sur place. */
function filtre(signal, type, frequence, q = 0.707) {
  const w = (2 * Math.PI * frequence) / FREQUENCE;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'bas') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = b0;
  } else if (type === 'haut') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = b0;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < signal.length; i += 1) {
    const x = signal[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    signal[i] = y;
  }
  return signal;
}

/* ---------- Instruments : chacun rend une note, en mono ---------- */

/** Un cycle de dent de scie plus ou moins adoucie : l'harmonique h pèse 1 / h^pente. */
function cycle(frequence, pente) {
  const taille = 2048;
  const onde = new Float32Array(taille + 1);
  const harmoniques = Math.min(48, Math.floor(15000 / frequence));
  for (let h = 1; h <= harmoniques; h += 1) {
    const poids = 1 / h ** pente;
    for (let i = 0; i <= taille; i += 1)
      onde[i] += poids * Math.sin((2 * Math.PI * h * i) / taille);
  }
  let max = 0;
  for (const v of onde) max = Math.max(max, Math.abs(v));
  for (let i = 0; i <= taille; i += 1) onde[i] /= max;
  return onde;
}

/** Une note de cuivre : attaque franche prise par en dessous, puis un son plus rond. */
function cuivre(note, duree, { force = 1, sombre = 0, chute = 0 } = {}) {
  const f0 = hz(note) * 2 ** (((alea() - 0.5) * 9) / 1200);
  const claire = cycle(f0, 1.0 + sombre);
  const ronde = cycle(f0, 1.9 + sombre);
  const queue = 0.07;
  const son = new Float32Array(rang(duree + queue));
  let phase = alea();
  for (let i = 0; i < son.length; i += 1) {
    const t = i / FREQUENCE;
    const prise = -45 * Math.exp(-t / 0.018);
    const vibrato =
      t > 0.16 ? 6 * Math.sin(2 * Math.PI * 5.6 * t) * Math.min(1, (t - 0.16) / 0.15) : 0;
    // `chute` : la note s'affaisse, en cents, sur toute sa durée (le « ouin » de l'échec).
    const glisse = -chute * (t / duree) ** 2;
    phase += (f0 * 2 ** ((prise + vibrato + glisse) / 1200)) / FREQUENCE;
    phase -= Math.floor(phase);
    const x = phase * 2048;
    const k = Math.floor(x);
    const brillante = claire[k] + (claire[k + 1] - claire[k]) * (x - k);
    const douce = ronde[k] + (ronde[k + 1] - ronde[k]) * (x - k);
    const eclat = Math.min(1, (0.42 + 0.58 * Math.exp(-t / 0.09)) * force);
    const attaque = Math.min(1, t / 0.012);
    const tenue = 0.78 + 0.22 * Math.exp(-t / 0.07);
    const fin = t > duree ? Math.max(0, 1 - (t - duree) / queue) : 1;
    son[i] = (douce + (brillante - douce) * eclat) * attaque * tenue * fin * force;
  }
  return son;
}

/** Une note de contrebasse pincée. */
function basse(note, duree) {
  const f = hz(note);
  const son = new Float32Array(rang(duree + 0.05));
  for (let i = 0; i < son.length; i += 1) {
    const t = i / FREQUENCE;
    const p = 2 * Math.PI * f * t;
    const corps =
      Math.sin(p) +
      0.45 * Math.sin(2 * p) * Math.exp(-t / 0.12) +
      0.2 * Math.sin(3 * p) * Math.exp(-t / 0.06);
    const fin = t > duree ? Math.max(0, 1 - (t - duree) / 0.05) : 1;
    son[i] = corps * Math.min(1, t / 0.004) * Math.exp(-t / 0.32) * fin;
  }
  return son;
}

/** Un accord d'orgue bref. */
function orgue(notes, duree) {
  const son = new Float32Array(rang(duree + 0.03));
  for (const note of notes) {
    const f = hz(note);
    for (let i = 0; i < son.length; i += 1) {
      const t = i / FREQUENCE;
      const p = 2 * Math.PI * f * t;
      const tirettes =
        Math.sin(p) + 0.6 * Math.sin(2 * p) + 0.35 * Math.sin(3 * p) + 0.2 * Math.sin(4 * p);
      const fin = t > duree ? Math.max(0, 1 - (t - duree) / 0.03) : 1;
      son[i] += (tirettes * Math.min(1, t / 0.004) * fin) / notes.length;
    }
  }
  return son;
}

/** Une note de carillon. */
function cloche(note, longueur = 1.1) {
  const f = hz(note);
  const partiels = [
    [1, 1, 0.5],
    [2.76, 0.45, 0.3],
    [5.4, 0.22, 0.16],
    [8.93, 0.1, 0.08],
  ];
  const son = new Float32Array(rang(longueur));
  for (let i = 0; i < son.length; i += 1) {
    const t = i / FREQUENCE;
    let v = 0;
    for (const [rapport, poids, declin] of partiels) {
      if (f * rapport < 18000)
        v += poids * Math.sin(2 * Math.PI * f * rapport * t) * Math.exp(-t / declin);
    }
    son[i] = v * Math.min(1, t / 0.002) * Math.min(1, (longueur - t) / 0.02);
  }
  return son;
}

function grosseCaisse() {
  const son = new Float32Array(rang(0.3));
  let phase = 0;
  for (let i = 0; i < son.length; i += 1) {
    const t = i / FREQUENCE;
    phase += (46 + 95 * Math.exp(-t / 0.028)) / FREQUENCE;
    son[i] =
      Math.sin(2 * Math.PI * phase) * Math.exp(-t / 0.11) + 0.25 * bruit() * Math.exp(-t / 0.004);
  }
  return son;
}

function caisseClaire(declin = 0.065) {
  const souffle = new Float32Array(rang(declin * 3.4));
  for (let i = 0; i < souffle.length; i += 1)
    souffle[i] = bruit() * Math.exp(-i / FREQUENCE / declin);
  filtre(souffle, 'haut', 1400);
  for (let i = 0; i < souffle.length; i += 1) {
    const t = i / FREQUENCE;
    souffle[i] = souffle[i] * 0.9 + 0.55 * Math.sin(2 * Math.PI * 195 * t) * Math.exp(-t / 0.045);
  }
  return souffle;
}

/** Cymbale : `declin` court pour la charleston, long pour le coup de cymbale. */
function cymbale(declin, coupure = 7000) {
  const son = new Float32Array(rang(Math.min(1.8, declin * 6)));
  for (let i = 0; i < son.length; i += 1) son[i] = bruit() * Math.exp(-i / FREQUENCE / declin);
  filtre(son, 'haut', coupure);
  return son;
}

/** Une frappe de timbale. */
function timbale(note, declin) {
  const f = hz(note);
  const son = new Float32Array(rang(declin * 5));
  for (let i = 0; i < son.length; i += 1) {
    const t = i / FREQUENCE;
    const p = 2 * Math.PI * f * t;
    son[i] =
      (Math.sin(p) + 0.5 * Math.sin(1.5 * p) + 0.3 * Math.sin(2 * p)) *
      Math.exp(-t / declin) *
      Math.min(1, t / 0.003);
  }
  return son;
}

/** Le battement d'une horloge : un petit bloc de bois, « tic » aigu ou « tac » plus grave. */
function battement(aigu) {
  const f = aigu ? 1850 : 1320;
  const son = new Float32Array(rang(0.11));
  for (let i = 0; i < son.length; i += 1) {
    const t = i / FREQUENCE;
    son[i] =
      (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.4 * t)) *
        Math.exp(-t / 0.014) +
      0.5 * bruit() * Math.exp(-t / 0.0015);
  }
  return filtre(son, 'haut', 500);
}

/* ---------- Mixage ---------- */

const piste = (duree) => new Float32Array(rang(duree));

/** Pose un son sur une piste, à `quand` secondes. `boucle` : ce qui dépasse la fin revient au début. */
function poser(cible, son, quand, gain = 1, boucle = false) {
  const debut = rang(quand);
  for (let i = 0; i < son.length; i += 1) {
    let k = debut + i;
    if (k >= cible.length) {
      if (!boucle) break;
      k %= cible.length;
    }
    cible[k] += son[i] * gain;
  }
}

/** Une petite salle : quatre échos en parallèle puis deux diffuseurs (Schroeder). */
function salle(entree) {
  const sortie = new Float32Array(entree.length);
  for (const [retard, retour] of [
    [0.0297, 0.76],
    [0.0371, 0.74],
    [0.0411, 0.72],
    [0.0437, 0.7],
  ]) {
    const d = rang(retard);
    const ligne = new Float32Array(entree.length);
    for (let i = 0; i < entree.length; i += 1) {
      ligne[i] = entree[i] + (i >= d ? ligne[i - d] * retour : 0);
      sortie[i] += ligne[i] / 4;
    }
  }
  for (const [retard, g] of [
    [0.005, 0.7],
    [0.0017, 0.7],
  ]) {
    const d = rang(retard);
    const avant = Float32Array.from(sortie);
    for (let i = 0; i < sortie.length; i += 1) {
      const retardee = i >= d ? avant[i - d] : 0;
      const precedente = i >= d ? sortie[i - d] : 0;
      sortie[i] = -g * avant[i] + retardee + g * precedente;
    }
  }
  return sortie;
}

/** Le son et un peu de sa salle, ramenés à une crête donnée, avec une fin sans clic. */
function finir(sec, { reverb = 0.22, crete = 0.85 } = {}) {
  const humide = salle(sec);
  const son = new Float32Array(sec.length);
  let max = 0;
  for (let i = 0; i < son.length; i += 1) {
    son[i] = sec[i] + humide[i] * reverb;
    max = Math.max(max, Math.abs(son[i]));
  }
  const fondu = rang(0.03);
  for (let i = 0; i < son.length; i += 1) {
    const fin = Math.min(1, (son.length - 1 - i) / fondu);
    son[i] = (son[i] / (max || 1)) * crete * fin;
  }
  return son;
}

/** Trois cuivres serrés : la mélodie en haut, une tierce et une sixte dessous. */
function trompettes(cible, quand, note, duree, force = 1, dessous = [-4, -9]) {
  poser(cible, cuivre(note, duree, { force }), quand, 0.5);
  for (const ecart of dessous)
    poser(cible, cuivre(note + ecart, duree, { force, sombre: 0.25 }), quand, 0.3);
}

/* ---------- Les sons ---------- */

/** Notes MIDI : do 4 = 60. La soirée est en fa majeur, comme le générique. */
const FA = 65;

const SONS = {
  /** Une seconde qui passe, dans les dix dernières : alternativement tic et tac. */
  tic: () => finir(poserSeul(battement(true), 0.14), { reverb: 0.08, crete: 0.7 }),
  tac: () => finir(poserSeul(battement(false), 0.14), { reverb: 0.08, crete: 0.7 }),

  /** Temps écoulé : deux cuivres graves qui frottent, sur une timbale. */
  'fin-de-temps': () => {
    const p = piste(1.1);
    poser(p, timbale(41, 0.16), 0, 0.9);
    poser(p, cuivre(53, 0.55, { sombre: 0.5, chute: 60 }), 0, 0.6);
    poser(p, cuivre(54, 0.55, { sombre: 0.5, chute: 60 }), 0, 0.5);
    poser(p, cuivre(41, 0.55, { sombre: 0.7 }), 0, 0.5);
    return finir(p);
  },

  /** Le chrono s'arrête pour l'indice : deux notes de carillon qui montent. */
  indice: () => {
    const p = piste(1);
    poser(p, cloche(FA + 12, 0.9), 0, 0.8);
    poser(p, cloche(FA + 19, 0.8), 0.16, 0.9);
    return finir(p, { reverb: 0.3 });
  },

  /** Réussite : l'arpège de fa monte aux cuivres et se pose, carillon et cymbale dessus. */
  reussite: () => {
    const p = piste(1.5);
    for (const [k, note] of [FA, FA + 4, FA + 7].entries()) trompettes(p, k * 0.1, note, 0.09, 1);
    trompettes(p, 0.3, FA + 12, 0.62, 1.1, [-5, -8]);
    poser(p, cloche(FA + 24, 1), 0.3, 0.35);
    poser(p, cymbale(0.22), 0.3, 0.3);
    poser(p, grosseCaisse(), 0.3, 0.7);
    return finir(p);
  },

  /** Échec : trois cuivres qui descendent par demi-tons, le dernier s'affaisse. */
  echec: () => {
    const p = piste(1.25);
    for (const [k, note] of [58, 57, 56].entries())
      poser(p, cuivre(note, 0.17, { sombre: 0.6 }), k * 0.2, 0.7);
    poser(p, cuivre(55, 0.5, { sombre: 0.7, chute: 180 }), 0.6, 0.8);
    poser(p, timbale(43, 0.14), 0.6, 0.5);
    // Tenu et grave, il paraîtrait plus fort que la réussite : on le garde en dessous.
    return finir(p, { crete: 0.6 });
  },

  /** La bonne réponse se dévoile : un arpège de carillon sur un accord d'orgue. */
  revelation: () => {
    const p = piste(1.1);
    for (const [k, note] of [FA + 7, FA + 12, FA + 16, FA + 19].entries())
      poser(p, cloche(note, 0.8), k * 0.07, 0.6);
    poser(p, orgue([FA, FA + 4, FA + 7], 0.5), 0.21, 0.25);
    return finir(p, { reverb: 0.32 });
  },

  /**
   * Entre deux jeux, sous le logo : quatre cuivres en levée (un par personnage qui arrive), et
   * l'accord quand ils se rejoignent, à 0,72 s.
   */
  jingle: () => {
    const p = piste(1.6);
    for (const [k, note] of [FA, FA + 4, FA + 7, FA + 9].entries()) {
      trompettes(p, k * 0.18, note, 0.13, 0.9);
      poser(p, basse(FA - 24 + [0, 4, 7, 9][k], 0.16), k * 0.18, 0.6);
    }
    trompettes(p, 0.72, FA + 12, 0.5, 1.1, [-5, -8]);
    poser(p, basse(FA - 24, 0.5), 0.72, 0.8);
    poser(p, grosseCaisse(), 0.72, 0.8);
    poser(p, cymbale(0.2), 0.72, 0.28);
    poser(p, cloche(FA + 24, 0.8), 0.72, 0.3);
    return finir(p);
  },

  /** Le tirage : un roulement de caisse claire qui enfle pendant 5 s, puis le coup de cymbale. */
  roulement: () => {
    const p = piste(6.4);
    for (let t = 0; t < 5; t += 1 / (20 + 6 * (t / 5))) {
      const avance = t / 5;
      poser(p, caisseClaire(0.03), t, (0.16 + 0.5 * avance ** 1.5) * (0.8 + 0.2 * alea()));
    }
    poser(p, timbale(41, 0.5), 3.4, 0.35);
    poser(p, timbale(41, 0.5), 4.2, 0.5);
    poser(p, cymbale(0.3), 5, 0.6);
    poser(p, grosseCaisse(), 5, 1);
    poser(p, timbale(FA - 24, 0.3), 5, 0.8);
    trompettes(p, 5, FA + 12, 0.7, 1.1, [-5, -8]);
    return finir(p);
  },

  /** Le podium : deux mesures de fanfare en fa, puis l'accord final tenu, carillon et cymbales. */
  fanfare: () => {
    const p = piste(6.4);
    const temps = (n) => n * TEMPS;
    // La mélodie : [temps, note, durée en temps]. Elle monte par paliers, comme le générique.
    const melodie = [
      [0, FA, 0.6],
      [SWING, FA + 4, 0.3],
      [1, FA + 7, 0.6],
      [1 + SWING, FA + 12, 0.3],
      [2, FA + 9, 0.9],
      [3, FA + 7, 0.6],
      [3 + SWING, FA + 9, 0.3],
      [4, FA + 12, 0.6],
      [4 + SWING, FA + 14, 0.3],
      [5, FA + 16, 0.6],
      [5 + SWING, FA + 14, 0.3],
      [6, FA + 12, 0.5],
      [6 + SWING, FA + 14, 0.3],
      [7, FA + 16, 0.9],
    ];
    for (const [quand, note, duree] of melodie)
      trompettes(p, temps(quand), note, temps(duree) * 0.92);
    // La basse marche sur chaque temps : fa, ré 7, sol mineur 7, do 7.
    for (const [k, note] of [41, 45, 48, 45, 38, 42, 45, 42].entries())
      poser(p, basse(note, TEMPS * 0.9), temps(k), 0.8);
    for (let k = 0; k < 8; k += 1) {
      if (k % 2 === 0) poser(p, grosseCaisse(), temps(k), 0.7);
      else poser(p, caisseClaire(), temps(k), 0.45);
      poser(p, cymbale(0.04, 8500), temps(k + SWING), 0.14);
    }
    // L'accord final, tenu : la salle applaudit dessus.
    const fin = temps(8);
    trompettes(p, fin, FA + 19, 2.2, 1.15, [-3, -7]);
    poser(p, cuivre(FA, 2.2, { sombre: 0.3 }), fin, 0.35);
    poser(p, basse(FA - 24, 1.2), fin, 0.9);
    poser(p, grosseCaisse(), fin, 1);
    poser(p, cymbale(0.3), fin, 0.55);
    for (let t = 0; t < 1.9; t += 0.07)
      poser(p, timbale(FA - 24, 0.2), fin + t, 0.16 + 0.1 * (t / 1.9));
    for (const [k, note] of [FA + 24, FA + 28, FA + 31, FA + 36].entries())
      poser(p, cloche(note, 1.1), fin + 0.15 + k * 0.12, 0.3);
    return finir(p, { reverb: 0.26 });
  },

  /** Un invité arrive : une goutte de carillon, discrète. */
  arrivee: () => {
    const p = piste(0.5);
    poser(p, cloche(FA + 28, 0.45), 0, 0.7);
    poser(p, cloche(FA + 31, 0.4), 0.05, 0.4);
    return finir(p, { reverb: 0.25, crete: 0.6 });
  },
};

function poserSeul(son, duree) {
  const p = piste(duree);
  poser(p, son, 0);
  return p;
}

/**
 * L'ambiance de l'accueil : douze mesures en boucle (19,2 s), sans couture. Une contrebasse qui
 * marche, un orgue à contretemps, une charleston en swing, quelques notes de carillon. Tout ce
 * qui dépasse la fin revient au début, et la salle est calculée sur deux tours : le second est
 * celui qu'on garde.
 */
function ambiance() {
  const MESURES = 12;
  const duree = MESURES * 4 * TEMPS;
  const p = piste(duree);
  const temps = (n) => n * TEMPS;
  // fa 6, ré 7, sol mineur 7, do 7 : la grille du générique, une mesure par accord.
  const GRILLE = [
    { basse: [41, 45, 48, 50], orgue: [57, 60, 62, 65] },
    { basse: [38, 42, 45, 48], orgue: [54, 57, 60, 62] },
    { basse: [43, 46, 50, 53], orgue: [55, 58, 62, 65] },
    { basse: [36, 40, 43, 46], orgue: [52, 55, 58, 60] },
  ];
  for (let m = 0; m < MESURES; m += 1) {
    const accord = GRILLE[m % 4];
    for (let k = 0; k < 4; k += 1) {
      const t = temps(m * 4 + k);
      poser(p, basse(accord.basse[k], TEMPS * 0.9), t, 0.75, true);
      poser(p, cymbale(0.05, 8000), t, k % 2 ? 0.1 : 0.06, true);
      poser(p, cymbale(0.03, 9000), t + TEMPS * SWING, 0.05, true);
      // L'orgue répond sur les contretemps des temps 2 et 4.
      if (k % 2) poser(p, orgue(accord.orgue, 0.11), t + TEMPS * SWING, 0.22, true);
    }
  }
  // Le carillon : une petite phrase toutes les quatre mesures, jamais deux fois la même.
  const PHRASES = [
    [
      [0, 77],
      [1.5, 81],
      [2 + SWING, 84],
      [5, 82],
      [6, 79],
    ],
    [
      [0 + SWING, 84],
      [2, 81],
      [3, 79],
      [4 + SWING, 77],
      [7, 81],
    ],
    [
      [1, 81],
      [2, 84],
      [3 + SWING, 86],
      [5, 84],
      [6 + SWING, 81],
      [8, 77],
    ],
  ];
  for (const [n, phrase] of PHRASES.entries())
    for (const [quand, note] of phrase)
      poser(p, cloche(note, 1), temps(n * 16 + quand), 0.22, true);

  // Deux tours bout à bout : la salle et les filtres du second tour ont entendu le premier.
  const double = new Float32Array(p.length * 2);
  double.set(p, 0);
  double.set(p, p.length);
  const humide = salle(double);
  for (let i = 0; i < double.length; i += 1) double[i] += humide[i] * 0.2;
  filtre(double, 'bas', 9000);
  filtre(double, 'bas', 9000);
  // Moitié moins d'échantillons : une musique de fond n'a pas besoin de plus de 11 kHz.
  const son = new Float32Array(p.length / 2);
  let max = 0;
  for (let i = 0; i < son.length; i += 1) {
    son[i] = double[p.length + i * 2];
    max = Math.max(max, Math.abs(son[i]));
  }
  for (let i = 0; i < son.length; i += 1) son[i] = (son[i] / max) * 0.7;
  return { son, frequence: FREQUENCE / 2 };
}

/* ---------- Écriture ---------- */

function wav(son, frequence = FREQUENCE) {
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
  entete.writeUInt32LE(frequence, 24);
  entete.writeUInt32LE(frequence * 2, 28);
  entete.writeUInt16LE(2, 32);
  entete.writeUInt16LE(16, 34);
  entete.write('data', 36);
  entete.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([entete, pcm]);
}

const dossier = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sons');
mkdirSync(dossier, { recursive: true });

const mesurer = (son) => {
  let crete = 0;
  let carres = 0;
  for (const v of son) {
    crete = Math.max(crete, Math.abs(v));
    carres += v * v;
  }
  return { crete, moyen: Math.sqrt(carres / son.length) };
};

let total = 0;
const ecrire = (nom, son, frequence = FREQUENCE) => {
  const fichier = wav(son, frequence);
  writeFileSync(path.join(dossier, `${nom}.wav`), fichier);
  total += fichier.length;
  const { crete, moyen } = mesurer(son);
  console.log(
    `${nom.padEnd(13)} ${(son.length / frequence).toFixed(2).padStart(5)} s  crête ${crete.toFixed(2)}  ` +
      `niveau moyen ${moyen.toFixed(3)}  ${(fichier.length / 1024).toFixed(0).padStart(4)} Ko`,
  );
};

for (const [nom, composer] of Object.entries(SONS)) ecrire(nom, composer());
const boucle = ambiance();
ecrire('ambiance', boucle.son, boucle.frequence);
// La couture de la boucle : l'écart entre le dernier échantillon et le premier doit être du
// même ordre que l'écart entre deux échantillons voisins ailleurs dans le morceau.
let voisins = 0;
for (let i = 1; i < boucle.son.length; i += 1)
  voisins = Math.max(voisins, Math.abs(boucle.son[i] - boucle.son[i - 1]));
const couture = Math.abs(boucle.son[0] - boucle.son.at(-1));
console.log(
  `couture de la boucle : ${couture.toFixed(4)} (plus grand écart entre voisins : ${voisins.toFixed(4)})`,
);
console.log(`total : ${(total / 1024 / 1024).toFixed(2)} Mo dans ${dossier}`);
