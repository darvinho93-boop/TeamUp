import {
  estBattement,
  fichierDe,
  FOND_SOUS_UN_SON,
  NIVEAUX,
  SONS,
  type Fond,
  type ReglageSon,
  type Son,
  type Variante,
} from '@/lib/sons';

/** Fondu d'une musique de fond, à l'entrée comme à la sortie, et du volume quand la régie le change. */
const FONDU_S = 0.8;
/** Deux arrivées rapprochées ne font qu'un son. */
const ESPACE_ARRIVEES_MS = 600;
/** Un son coupé par le suivant s'éteint en un clin d'œil, sans clic. */
const COUPE_S = 0.06;
/** Le canal par lequel les onglets d'un même navigateur se passent le son. */
const CANAL = 'teamup-son';

export interface Lecteur {
  /** Joue un son, tout de suite ou après un délai (le jingle attend la fin de l'interlude). */
  jouer(son: Son, apresMs?: number): void;
  /** La musique de fond, en boucle : en changer ou l'éteindre (`null`), en fondu. */
  fond(son: Fond | null): void;
  regler(reglage: ReglageSon): void;
  /**
   * Met le lecteur en veille, ou le réveille. Réversible, contrairement à une fermeture : en
   * développement, React démonte et remonte chaque composant une fois, et un lecteur fermé à ce
   * moment-là resterait muet pour de bon.
   */
  veiller(endormi: boolean): void;
  /** Pour les contrôles : l'état du contexte audio et le niveau réellement envoyé en sortie. */
  mesure(): { etat: AudioContextState; niveau: number };
  /** Ce qui a été joué, pour les contrôles : le nom du son et l'instant (ms). */
  journal: { son: Son; a: number }[];
  /** Le dernier réglage appliqué, pour les contrôles. */
  reglage: ReglageSon;
}

/**
 * Le lecteur de l'écran commun. À créer dans un geste de l'utilisateur (un clic) : sans cela, le
 * navigateur refuse de jouer. Tous les sons sont chargés et décodés d'avance, pour partir sans
 * délai le moment venu.
 */
export async function creerLecteur(
  reglage: ReglageSon,
  {
    variante,
    groupe = crypto.randomUUID(),
    surCession,
  }: {
    /** Une version imposée pour tous les sons (page d'écoute) ; sinon celle retenue pour chacun. */
    variante?: Variante;
    /** Les lecteurs d'un même groupe cohabitent (les versions A et B de la page d'écoute). */
    groupe?: string;
    /** Un autre onglet vient d'activer le son : celui-ci s'est tu. */
    surCession?: () => void;
  } = {},
): Promise<Lecteur> {
  const contexte = new AudioContext();
  await contexte.resume();
  const sortie = contexte.createGain();
  sortie.gain.value = reglage.actif ? reglage.volume / 100 : 0;
  sortie.connect(contexte.destination);
  const sonde = contexte.createAnalyser();
  sortie.connect(sonde);
  const echantillons = new Float32Array(sonde.fftSize);

  const tampons = new Map<Son, AudioBuffer>();
  await Promise.all(
    SONS.map(async (son) => {
      const reponse = await fetch(fichierDe(son, variante));
      if (!reponse.ok) return;
      tampons.set(son, await contexte.decodeAudioData(await reponse.arrayBuffer()));
    }),
  );

  const journal: Lecteur['journal'] = [];
  let derniereArrivee = 0;
  let boucle: { son: Fond; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  /** Le son (hors battements) qui joue encore : le suivant le coupera. */
  let enCours: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  // Un seul onglet sonne à la fois : deux écrans ouverts sur le même ordinateur joueraient
  // chaque son deux fois, un peu décalés. Le dernier activé garde le son, les autres se taisent.
  const canal = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CANAL);
  canal?.postMessage(groupe);
  if (canal) {
    canal.onmessage = (message) => {
      if (message.data === groupe) return;
      void contexte.suspend();
      surCession?.();
    };
  }

  /** La musique de fond s'efface sous un son, puis revient. */
  const effacerLeFond = (dureeS: number) => {
    if (!boucle) return;
    const t = contexte.currentTime;
    const { gain } = boucle.gain;
    gain.cancelScheduledValues(t);
    gain.setTargetAtTime(NIVEAUX[boucle.son] * FOND_SOUS_UN_SON, t, COUPE_S);
    gain.setTargetAtTime(NIVEAUX[boucle.son], t + dureeS, FONDU_S / 3);
  };

  const source = (son: Son, niveau: number) => {
    const tampon = tampons.get(son);
    if (!tampon) return null;
    const noeud = contexte.createBufferSource();
    noeud.buffer = tampon;
    const gain = contexte.createGain();
    gain.gain.value = niveau;
    noeud.connect(gain).connect(sortie);
    return { source: noeud, gain };
  };

  const lecteur: Lecteur = {
    journal,
    reglage,
    jouer(son, apresMs = 0) {
      if (apresMs > 0) {
        setTimeout(() => lecteur.jouer(son), apresMs);
        return;
      }
      const maintenant = performance.now();
      if (son === 'arrivee') {
        if (maintenant - derniereArrivee < ESPACE_ARRIVEES_MS) return;
        derniereArrivee = maintenant;
      }
      const voix = source(son, NIVEAUX[son]);
      if (!voix) return;
      if (!estBattement(son)) {
        // Un son à la fois : celui qui jouait encore s'éteint, la musique de fond s'efface dessous.
        if (enCours) {
          const t = contexte.currentTime;
          enCours.gain.gain.setTargetAtTime(0, t, COUPE_S / 3);
          enCours.source.stop(t + COUPE_S);
        }
        enCours = voix;
        voix.source.onended = () => {
          if (enCours === voix) enCours = null;
        };
        effacerLeFond(voix.source.buffer?.duration ?? 1);
      }
      voix.source.start();
      journal.push({ son, a: Math.round(maintenant) });
    },
    fond(son) {
      if (boucle?.son === son || (!boucle && !son)) return;
      const t = contexte.currentTime;
      if (boucle) {
        const { source: noeud, gain } = boucle;
        boucle = null;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + FONDU_S);
        noeud.stop(t + FONDU_S);
      }
      if (!son) return;
      const voix = source(son, 0);
      if (!voix) return;
      voix.source.loop = true;
      voix.gain.gain.linearRampToValueAtTime(NIVEAUX[son], t + FONDU_S);
      voix.source.start();
      boucle = { son, ...voix };
      journal.push({ son, a: Math.round(performance.now()) });
    },
    regler({ actif, volume }) {
      lecteur.reglage = { actif, volume };
      sortie.gain.setTargetAtTime(actif ? volume / 100 : 0, contexte.currentTime, FONDU_S / 5);
    },
    veiller(endormi) {
      void (endormi ? contexte.suspend() : contexte.resume());
    },
    mesure() {
      sonde.getFloatTimeDomainData(echantillons);
      let carres = 0;
      for (const v of echantillons) carres += v * v;
      return { etat: contexte.state, niveau: Math.sqrt(carres / echantillons.length) };
    },
  };
  return lecteur;
}
