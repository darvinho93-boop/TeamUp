import {
  estBattement,
  fichierDe,
  FOND_SOUS_UN_SON,
  FONDU_MUSIQUE_MS,
  NIVEAU_MUSIQUE,
  NIVEAUX,
  SONS,
  type Fond,
  type Montee,
  type ReglageSon,
  type Son,
} from '@/lib/sons';

/** Fondu d'une musique de fond, à l'entrée comme à la sortie, et du volume quand la régie le change. */
const FONDU_S = FONDU_MUSIQUE_MS / 1000;
/** Deux arrivées rapprochées ne font qu'un son. */
const ESPACE_ARRIVEES_MS = 600;
/** Un son coupé par le suivant s'éteint en un clin d'œil, sans clic. */
const COUPE_S = 0.06;
/** Le canal par lequel les onglets d'un même navigateur se passent le son. */
const CANAL = 'teamup-son';

export interface Lecteur {
  /**
   * Joue un son, tout de suite ou après un délai (le jingle attend la fin de l'interlude) ;
   * `montee` en change le niveau et la vitesse (le battement des dernières secondes) ;
   * `dansLeSonMs` le prend en route (la passe finale reprise en cours de boucle).
   */
  jouer(son: Son, apresMs?: number, montee?: Montee, dansLeSonMs?: number): void;
  /** La musique de fond, en boucle : en changer ou l'éteindre (`null`), en fondu. */
  fond(son: Fond | null): void;
  /**
   * Télécharge d'avance un MP3 de la bibliothèque (2026-11-15), gardé tel quel en mémoire (un
   * MP3 décodé pèserait dix fois plus) : il joue sans délai, même si le réseau tombe ensuite ou
   * si son URL signée expire. `cle` est l'identifiant de la musique.
   */
  charger(cle: string, url: string): Promise<void>;
  /** La musique sous le chrono : en changer ou l'éteindre (`null`), en fondu, en boucle. */
  musique(cle: string | null): void;
  regler(reglage: ReglageSon): void;
  /**
   * Met le lecteur en veille, ou le réveille. Réversible, contrairement à une fermeture : en
   * développement, React démonte et remonte chaque composant une fois, et un lecteur fermé à ce
   * moment-là resterait muet pour de bon.
   */
  veiller(endormi: boolean): void;
  /** Pour les contrôles : l'état du contexte audio et le niveau réellement envoyé en sortie. */
  mesure(): { etat: AudioContextState; niveau: number };
  /**
   * Ce qui a été joué, pour les contrôles : le nom du son et l'instant (ms). Une musique y paraît
   * en `musique:<id>` à son départ, `musique:-` à son arrêt.
   */
  journal: { son: Son | `musique:${string}`; a: number }[];
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
    groupe = crypto.randomUUID(),
    surCession,
  }: {
    /** Les lecteurs d'un même groupe cohabitent dans un onglet sans se couper le son. */
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
      const reponse = await fetch(fichierDe(son));
      if (!reponse.ok) return;
      tampons.set(son, await contexte.decodeAudioData(await reponse.arrayBuffer()));
    }),
  );

  const journal: Lecteur['journal'] = [];
  let derniereArrivee = 0;
  let boucle: { son: Fond; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  /** Le son (hors battements) qui joue encore : le suivant le coupera. */
  let enCours: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Les musiques téléchargées (adresse locale du fichier), puis leur lecteur une fois jouées. */
  const fichiers = new Map<string, Promise<string | null>>();
  const pistes = new Map<string, { audio: HTMLAudioElement; gain: GainNode }>();
  /** La musique voulue en ce moment : celle qui finit de charger ne part que si elle l'est encore. */
  let musiqueVoulue: string | null = null;
  /** La musique qui joue (ou monte) : un second `charger` ne la relance pas. */
  let jouee: string | null = null;

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

  /** La musique de fond et celle du chrono s'effacent sous un son, puis reviennent. */
  const effacerLeFond = (dureeS: number) => {
    const t = contexte.currentTime;
    const sous = (gain: AudioParam, niveau: number) => {
      gain.cancelScheduledValues(t);
      gain.setTargetAtTime(niveau * FOND_SOUS_UN_SON, t, COUPE_S);
      gain.setTargetAtTime(niveau, t + dureeS, FONDU_S / 3);
    };
    if (boucle) sous(boucle.gain.gain, NIVEAUX[boucle.son]);
    const piste = musiqueVoulue ? pistes.get(musiqueVoulue) : undefined;
    if (piste && !piste.audio.paused) sous(piste.gain.gain, NIVEAU_MUSIQUE);
  };

  /** Arrête une musique en fondu, puis la met en pause au début, prête à repartir. */
  const eteindre = (piste: { audio: HTMLAudioElement; gain: GainNode }) => {
    const t = contexte.currentTime;
    piste.gain.gain.cancelScheduledValues(t);
    piste.gain.gain.setValueAtTime(piste.gain.gain.value, t);
    piste.gain.gain.linearRampToValueAtTime(0, t + FONDU_S);
    setTimeout(
      () => {
        // Redemandée pendant le fondu : elle continue.
        if (pistes.get(musiqueVoulue ?? '') === piste) return;
        piste.audio.pause();
        piste.audio.currentTime = 0;
      },
      FONDU_S * 1000 + 50,
    );
  };

  const allumer = (cle: string, adresse: string) => {
    if (musiqueVoulue !== cle || jouee === cle) return;
    jouee = cle;
    let piste = pistes.get(cle);
    if (!piste) {
      const audio = new Audio(adresse);
      audio.loop = true;
      audio.preload = 'auto';
      const gain = contexte.createGain();
      gain.gain.value = 0;
      contexte.createMediaElementSource(audio).connect(gain).connect(sortie);
      piste = { audio, gain };
      pistes.set(cle, piste);
    }
    const t = contexte.currentTime;
    piste.gain.gain.cancelScheduledValues(t);
    piste.gain.gain.setValueAtTime(piste.gain.gain.value, t);
    piste.gain.gain.linearRampToValueAtTime(NIVEAU_MUSIQUE, t + FONDU_S);
    void piste.audio.play().catch(() => undefined);
    journal.push({ son: `musique:${cle}`, a: Math.round(performance.now()) });
  };

  const source = (son: Son, niveau: number, vitesse = 1) => {
    const tampon = tampons.get(son);
    if (!tampon) return null;
    const noeud = contexte.createBufferSource();
    noeud.buffer = tampon;
    noeud.playbackRate.value = vitesse;
    const gain = contexte.createGain();
    gain.gain.value = niveau;
    noeud.connect(gain).connect(sortie);
    return { source: noeud, gain };
  };

  const lecteur: Lecteur = {
    journal,
    reglage,
    jouer(son, apresMs = 0, montee, dansLeSonMs = 0) {
      if (apresMs > 0) {
        setTimeout(() => lecteur.jouer(son, 0, montee, dansLeSonMs), apresMs);
        return;
      }
      const maintenant = performance.now();
      if (son === 'arrivee') {
        if (maintenant - derniereArrivee < ESPACE_ARRIVEES_MS) return;
        derniereArrivee = maintenant;
      }
      const voix = source(son, NIVEAUX[son] * (montee?.gain ?? 1), montee?.vitesse);
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
        effacerLeFond(Math.max(0, (voix.source.buffer?.duration ?? 1) - dansLeSonMs / 1000));
      }
      voix.source.start(0, dansLeSonMs / 1000);
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
    charger(cle, url) {
      let fichier = fichiers.get(cle);
      if (!fichier) {
        fichier = fetch(url)
          .then((reponse) => (reponse.ok ? reponse.blob() : null))
          .then((blob) => (blob ? URL.createObjectURL(blob) : null))
          .catch(() => null);
        fichiers.set(cle, fichier);
        // Un échec (réseau, URL expirée) se retente à la demande suivante.
        void fichier.then((adresse) => {
          if (!adresse) fichiers.delete(cle);
        });
      }
      return fichier.then((adresse) => {
        if (adresse) allumer(cle, adresse);
      });
    },
    musique(cle) {
      if (cle === musiqueVoulue) return;
      const avant = musiqueVoulue ? pistes.get(musiqueVoulue) : undefined;
      musiqueVoulue = cle;
      jouee = null;
      if (avant) {
        eteindre(avant);
        if (!cle) journal.push({ son: 'musique:-', a: Math.round(performance.now()) });
      }
      if (!cle) return;
      // Pas encore téléchargée : elle partira à la fin de `charger`, si elle est encore voulue.
      void fichiers.get(cle)?.then((adresse) => {
        if (adresse) allumer(cle, adresse);
      });
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
