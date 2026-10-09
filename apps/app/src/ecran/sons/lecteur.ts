import { NIVEAUX, SONS, type ReglageSon, type Son } from '@/lib/sons';

/** Fondu de l'ambiance, à l'entrée comme à la sortie, et du volume quand la régie le change. */
const FONDU_S = 0.8;
/** Deux arrivées rapprochées ne font qu'un son. */
const ESPACE_ARRIVEES_MS = 600;

export interface Lecteur {
  jouer(son: Son): void;
  /** L'ambiance en boucle : la lancer ou l'éteindre, en fondu. */
  ambiance(active: boolean): void;
  regler(reglage: ReglageSon): void;
  fermer(): void;
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
export async function creerLecteur(reglage: ReglageSon): Promise<Lecteur> {
  const contexte = new AudioContext();
  await contexte.resume();
  const sortie = contexte.createGain();
  sortie.gain.value = reglage.actif ? reglage.volume / 100 : 0;
  sortie.connect(contexte.destination);

  const tampons = new Map<Son, AudioBuffer>();
  await Promise.all(
    SONS.map(async (son) => {
      const reponse = await fetch(`/sons/${son}.wav`);
      if (!reponse.ok) return;
      tampons.set(son, await contexte.decodeAudioData(await reponse.arrayBuffer()));
    }),
  );

  const journal: Lecteur['journal'] = [];
  let derniereArrivee = 0;
  let boucle: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

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
    jouer(son) {
      const maintenant = performance.now();
      if (son === 'arrivee') {
        if (maintenant - derniereArrivee < ESPACE_ARRIVEES_MS) return;
        derniereArrivee = maintenant;
      }
      const voix = source(son, NIVEAUX[son]);
      if (!voix) return;
      voix.source.start();
      journal.push({ son, a: Math.round(maintenant) });
    },
    ambiance(active) {
      const t = contexte.currentTime;
      if (active && !boucle) {
        const voix = source('ambiance', 0);
        if (!voix) return;
        voix.source.loop = true;
        voix.gain.gain.linearRampToValueAtTime(NIVEAUX.ambiance, t + FONDU_S);
        voix.source.start();
        boucle = voix;
        journal.push({ son: 'ambiance', a: Math.round(performance.now()) });
      } else if (!active && boucle) {
        const { source: noeud, gain } = boucle;
        boucle = null;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + FONDU_S);
        noeud.stop(t + FONDU_S);
      }
    },
    regler({ actif, volume }) {
      lecteur.reglage = { actif, volume };
      sortie.gain.setTargetAtTime(actif ? volume / 100 : 0, contexte.currentTime, FONDU_S / 5);
    },
    fermer() {
      void contexte.close();
    },
  };
  return lecteur;
}
