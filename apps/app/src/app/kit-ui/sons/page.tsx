'use client';

import { useEffect, useState } from 'react';
import { Button } from '@teamup/ui/react';
import { CHOIX, SONS, VARIANTES, type Son, type Variante } from '@/lib/sons';
import { creerLecteur, type Lecteur } from '@/ecran/sons/lecteur';

const MOMENTS: Record<Son, string> = {
  tic: 'Chrono : une seconde des dix dernières',
  tac: 'Chrono : la seconde suivante',
  'fin-de-temps': 'Chrono : temps écoulé',
  indice: 'Points communs : le chrono s’arrête pour l’indice',
  reussite: 'Trouvé, pari tenu, gagnante d’un thème, duel gagné',
  echec: 'Raté, échec',
  revelation: 'Quiz : la bonne réponse s’affiche',
  jingle: 'Le logo passe entre deux jeux',
  roulement: 'Tirage de l’ordre de passage (5 s, puis le coup de cymbale)',
  fanfare: 'Le podium s’affiche',
  arrivee: 'Un invité rejoint la soirée',
  ambiance: 'Accueil : musique de fond, en boucle',
};

type Lecteurs = Record<Variante, Lecteur>;

/**
 * Page d'écoute : chaque son de l'écran commun, dans ses deux versions, à juger à l'oreille.
 * Le bouton plein est la version que l'écran joue aujourd'hui (`CHOIX`, dans `src/lib/sons.ts`).
 */
export default function KitSons() {
  const [lecteurs, setLecteurs] = useState<Lecteurs | null>(null);
  const [volume, setVolume] = useState(80);
  const [ambiance, setAmbiance] = useState<Variante | null>(null);

  // En veille quand la page se démonte, réveillés sinon (voir `Lecteur.veiller`).
  useEffect(() => {
    if (!lecteurs) return;
    for (const v of VARIANTES) lecteurs[v].veiller(false);
    return () => {
      for (const v of VARIANTES) lecteurs[v].veiller(true);
    };
  }, [lecteurs]);
  useEffect(() => {
    if (lecteurs) for (const v of VARIANTES) lecteurs[v].regler({ actif: true, volume });
  }, [lecteurs, volume]);
  useEffect(() => {
    if (lecteurs) for (const v of VARIANTES) lecteurs[v].ambiance(ambiance === v);
  }, [lecteurs, ambiance]);

  if (!lecteurs) {
    const activer = async () => {
      const reglage = { actif: true, volume };
      const [a, b] = await Promise.all([creerLecteur(reglage, 'a'), creerLecteur(reglage, 'b')]);
      window.__tuLecteur = a;
      setLecteurs({ a, b });
    };
    return (
      <main className="tu-regie__main tu-regie__main--narrow">
        <h1 className="tu-regie__title">Sons de l’écran commun</h1>
        <p>Le navigateur demande un clic avant de jouer du son.</p>
        <Button onClick={() => void activer()}>Activer le son</Button>
      </main>
    );
  }

  return (
    <main className="tu-regie__main tu-regie__main--narrow">
      <h1 className="tu-regie__title">Sons de l’écran commun</h1>
      <p className="tu-regie__muted">
        Deux versions par son. Le bouton plein est la version que l’écran joue aujourd’hui.
      </p>
      <label className="tu-regie-son__volume">
        <span>Volume {volume} %</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>
      <ul className="tu-regie-list">
        {SONS.map((son) => (
          <li key={son} className="tu-cluster">
            <strong>{son}</strong>
            {VARIANTES.map((v) =>
              son === 'ambiance' ? (
                <Button
                  key={v}
                  variant={CHOIX[son] === v ? 'primary' : 'ghost'}
                  aria-pressed={ambiance === v}
                  onClick={() => setAmbiance(ambiance === v ? null : v)}
                >
                  {ambiance === v ? `Arrêter ${v.toUpperCase()}` : v.toUpperCase()}
                </Button>
              ) : (
                <Button
                  key={v}
                  variant={CHOIX[son] === v ? 'primary' : 'ghost'}
                  onClick={() => lecteurs[v].jouer(son)}
                >
                  {v.toUpperCase()}
                </Button>
              ),
            )}
            <span className="tu-regie__muted">{MOMENTS[son]}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
