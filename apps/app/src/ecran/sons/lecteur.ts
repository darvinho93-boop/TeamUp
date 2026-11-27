import {
  estBattement,
  fichierDe,
  FOND_SOUS_UN_SON,
  FONDU_MUSIQUE_MS,
  NIVEAU_AMBIANCE_THEME,
  NIVEAU_EXTRAIT,
  NIVEAU_FAIRE_PART,
  NIVEAU_MUSIQUE,
  NIVEAUX,
  SONS,
  type FondJoue,
  type Montee,
  type ReglageSon,
  type Son,
} from '@/lib/sons';
import { identifiantAleatoire } from '@/lib/identifiant';

/** Fondu d'une musique de fond, à l'entrée comme à la sortie, et du volume quand la régie le change. */
const FONDU_S = FONDU_MUSIQUE_MS / 1000;
/** Deux arrivées rapprochées ne font qu'un son. */
const ESPACE_ARRIVEES_MS = 600;
/** Un son coupé par le suivant s'éteint en un clin d'œil, sans clic. */
const COUPE_S = 0.06;
/** Les sons d'une soirée à thème (2026-11-27), téléchargés de son bucket. */
type SonTheme = 'faire-part' | 'ambiance-theme';
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
  fond(son: FondJoue | null): void;
  /**
   * Soirée à thème (2026-11-27) : décode d'avance sa musique d'arrivée et son ambiance, déjà
   * téléchargées (adresses `blob:`). Sans elles, rien ne change.
   */
  chargerTheme(sons: { musique: string | null; ambiance: string | null }): Promise<void>;
  /**
   * La musique d'arrivée d'une soirée à thème : elle part quand le reel s'éteint, sans le couper
   * (revu le 2026-11-27) ; la musique de fond s'arrête et ne reprend qu'à sa fin. Les autres sons
   * (une arrivée) se posent dessus sans la couper.
   */
  jouerFairePart(apresMs?: number, dansLeSonMs?: number): void;
  /** L'arrête en fondu (la régie a quitté l'accueil) ; la musique de fond reprend. */
  arreterFairePart(): void;
  /**
   * Télécharge d'avance un MP3 de la bibliothèque (2026-11-15), gardé tel quel en mémoire (un
   * MP3 décodé pèserait dix fois plus) : il joue sans délai, même si le réseau tombe ensuite ou
   * si son URL signée expire. `cle` est l'identifiant de la musique.
   */
  charger(cle: string, url: string): Promise<void>;
  /** La musique sous le chrono : en changer ou l'éteindre (`null`), en fondu, en boucle. */
  musique(cle: string | null): void;
  /**
   * Blind test (2026-11-15) : joue l'extrait `cle` à partir de `depuisS` secondes, sans boucle, ou
   * l'arrête (`null`) : net par défaut, un buzz coupe la musique sur-le-champ ; en `fonduS` secondes
   * quand la régie coupe le karaoké. Pas encore téléchargé, il part à la fin du téléchargement, à
   * la seconde où il en serait.
   */
  extrait(cle: string | null, depuisS?: number, fonduS?: number): void;
  /** Où en est vraiment la chanson qui joue, en secondes ; `null` si rien ne joue. */
  positionExtrait(): number | null;
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
  journal: { son: Son | SonTheme | `musique:${string}` | `extrait:${string}`; a: number }[];
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
    // Pas `crypto.randomUUID` : absent d'un écran ouvert en http par l'adresse du PC de la salle.
    groupe = identifiantAleatoire(),
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

  const tampons = new Map<Son | SonTheme, AudioBuffer>();
  await Promise.all(
    SONS.map(async (son) => {
      const reponse = await fetch(fichierDe(son));
      if (!reponse.ok) return;
      tampons.set(son, await contexte.decodeAudioData(await reponse.arrayBuffer()));
    }),
  );

  const journal: Lecteur['journal'] = [];
  let derniereArrivee = 0;
  let boucle: { son: FondJoue; source: AudioBufferSourceNode; gain: GainNode } | null = null;
  /** La musique de fond demandée : celle qui reprend après la musique d'arrivée d'un thème. */
  let fondVoulu: FondJoue | null = null;
  /** La musique d'arrivée d'une soirée à thème, tant qu'elle joue. */
  let fairePart: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  const niveauDuFond = (son: FondJoue) =>
    son === 'ambiance-theme' ? NIVEAU_AMBIANCE_THEME : NIVEAUX[son];
  /** Le son (hors battements) qui joue encore : le suivant le coupera. */
  let enCours: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Les musiques téléchargées (adresse locale du fichier), puis leur lecteur une fois jouées. */
  const fichiers = new Map<string, Promise<string | null>>();
  const pistes = new Map<string, { audio: HTMLAudioElement; gain: GainNode }>();
  /** La musique voulue en ce moment : celle qui finit de charger ne part que si elle l'est encore. */
  let musiqueVoulue: string | null = null;
  /** La musique qui joue (ou monte) : un second `charger` ne la relance pas. */
  let jouee: string | null = null;
  /** L'extrait du blind test voulu : la clé, sa seconde de départ et l'instant de la demande. */
  let extraitVoulu: { cle: string; depuisS: number; a: number } | null = null;
  let extraitJoue: { audio: HTMLAudioElement; gain: GainNode } | null = null;

  /** Le lecteur d'un fichier téléchargé, créé une fois : un `<audio>` relié au contexte. */
  const pisteDe = (cle: string, adresse: string) => {
    let piste = pistes.get(cle);
    if (!piste) {
      const audio = new Audio(adresse);
      audio.preload = 'auto';
      const gain = contexte.createGain();
      gain.gain.value = 0;
      contexte.createMediaElementSource(audio).connect(gain).connect(sortie);
      piste = { audio, gain };
      pistes.set(cle, piste);
    }
    return piste;
  };

  const lancerExtrait = (adresse: string) => {
    const voulu = extraitVoulu;
    if (!voulu) return;
    const piste = pisteDe(voulu.cle, adresse);
    piste.audio.loop = false;
    piste.audio.currentTime = voulu.depuisS + (performance.now() - voulu.a) / 1000;
    const t = contexte.currentTime;
    piste.gain.gain.cancelScheduledValues(t);
    piste.gain.gain.setValueAtTime(0, t);
    piste.gain.gain.linearRampToValueAtTime(NIVEAU_EXTRAIT, t + COUPE_S);
    void piste.audio.play().catch(() => undefined);
    extraitJoue = piste;
    journal.push({ son: `extrait:${voulu.cle}`, a: Math.round(performance.now()) });
  };

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
    if (boucle) sous(boucle.gain.gain, niveauDuFond(boucle.son));
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
    const piste = pisteDe(cle, adresse);
    piste.audio.loop = true;
    const t = contexte.currentTime;
    piste.gain.gain.cancelScheduledValues(t);
    piste.gain.gain.setValueAtTime(piste.gain.gain.value, t);
    piste.gain.gain.linearRampToValueAtTime(NIVEAU_MUSIQUE, t + FONDU_S);
    void piste.audio.play().catch(() => undefined);
    journal.push({ son: `musique:${cle}`, a: Math.round(performance.now()) });
  };

  /** Éteint la musique de fond en fondu. */
  const arreterLaBoucle = () => {
    if (!boucle) return;
    const t = contexte.currentTime;
    const { source: noeud, gain } = boucle;
    boucle = null;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + FONDU_S);
    noeud.stop(t + FONDU_S);
  };

  const source = (son: Son | SonTheme, niveau: number, vitesse = 1) => {
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
    fond(voulu) {
      fondVoulu = voulu;
      // Pendant la musique d'arrivée d'un thème, la musique de fond attend sa fin.
      if (fairePart) return;
      // L'ambiance d'un thème pas encore décodée : celle de Team Up! en attendant.
      const son = voulu === 'ambiance-theme' && !tampons.has(voulu) ? 'ambiance' : voulu;
      if (boucle?.son === son || (!boucle && !son)) return;
      const t = contexte.currentTime;
      arreterLaBoucle();
      if (!son) return;
      const voix = source(son, 0);
      if (!voix) return;
      voix.source.loop = true;
      voix.gain.gain.linearRampToValueAtTime(niveauDuFond(son), t + FONDU_S);
      voix.source.start();
      boucle = { son, ...voix };
      journal.push({ son, a: Math.round(performance.now()) });
    },
    async chargerTheme({ musique, ambiance }) {
      const aDecoder: [SonTheme, string | null][] = [
        ['faire-part', musique],
        ['ambiance-theme', ambiance],
      ];
      await Promise.all(
        aDecoder.map(async ([son, adresse]) => {
          if (!adresse || tampons.has(son)) return;
          try {
            const reponse = await fetch(adresse);
            tampons.set(son, await contexte.decodeAudioData(await reponse.arrayBuffer()));
          } catch {
            // Illisible : la soirée garde les sons de Team Up!.
          }
        }),
      );
      // L'ambiance du thème arrive : elle prend la place de celle de Team Up! si on l'attendait.
      if (fondVoulu === 'ambiance-theme') lecteur.fond(fondVoulu);
    },
    jouerFairePart(apresMs = 0, dansLeSonMs = 0) {
      if (apresMs > 0) {
        setTimeout(() => lecteur.jouerFairePart(0, dansLeSonMs), apresMs);
        return;
      }
      const voix = source('faire-part', NIVEAU_FAIRE_PART);
      if (!voix || fairePart) return;
      arreterLaBoucle();
      fairePart = voix;
      voix.source.onended = () => {
        if (fairePart !== voix) return;
        fairePart = null;
        lecteur.fond(fondVoulu);
      };
      voix.source.start(0, dansLeSonMs / 1000);
      journal.push({ son: 'faire-part', a: Math.round(performance.now()) });
    },
    arreterFairePart() {
      if (!fairePart) return;
      const { source: noeud, gain } = fairePart;
      fairePart = null;
      const t = contexte.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + FONDU_S);
      noeud.stop(t + FONDU_S);
      lecteur.fond(fondVoulu);
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
        if (!adresse) return;
        allumer(cle, adresse);
        if (extraitVoulu?.cle === cle && !extraitJoue) lancerExtrait(adresse);
      });
    },
    extrait(cle, depuisS = 0, fonduS = COUPE_S) {
      // Déjà en train de jouer cet extrait : il continue (un rendu de plus ne le relance pas).
      if (cle !== null && cle === extraitVoulu?.cle && extraitJoue) return;
      if (extraitJoue) {
        // Net pour un buzz, en fondu pour la fin d'un karaoké.
        const { audio, gain } = extraitJoue;
        const t = contexte.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + fonduS);
        // Relancée entre-temps (le karaoké juste après le buzz) : la même piste continue.
        setTimeout(
          () => {
            if (extraitJoue?.audio !== audio) audio.pause();
          },
          fonduS * 1000 + 20,
        );
        extraitJoue = null;
        journal.push({ son: 'extrait:-', a: Math.round(performance.now()) });
      }
      extraitVoulu = cle ? { cle, depuisS, a: performance.now() } : null;
      if (!cle) return;
      void fichiers.get(cle)?.then((adresse) => {
        if (adresse && extraitVoulu?.cle === cle && !extraitJoue) lancerExtrait(adresse);
      });
    },
    positionExtrait() {
      if (!extraitJoue || extraitJoue.audio.paused || extraitJoue.audio.ended) return null;
      return extraitJoue.audio.currentTime;
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
