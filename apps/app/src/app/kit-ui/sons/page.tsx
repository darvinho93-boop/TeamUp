'use client';

import { useEffect, useState } from 'react';
import { Button } from '@teamup/ui/react';
import { SONS, type Fond, type Son } from '@/lib/sons';
import { creerLecteur, type Lecteur } from '@/ecran/sons/lecteur';

const MOMENTS: Record<Son, string> = {
  tic: 'Chrono : une seconde des dix dernières',
  tac: 'Chrono : la seconde suivante',
  'fin-de-temps': 'Chrono : temps écoulé',
  indice: 'Points communs : le chrono s’arrête pour l’indice',
  reussite: 'Trouvé, pari tenu, gagnante d’un thème, duel gagné',
  echec: 'Raté, échec',
  revelation: 'Quiz : la bonne réponse s’affiche',
  presentation: 'Présenter un jeu : roulement pendant que le logo est à l’écran',
  jingle: 'Présenter un jeu : le nom du jeu paraît',
  roulement: 'Tirage de l’ordre de passage (5 s, puis le coup de cymbale)',
  fanfare: 'Le podium s’affiche',
  arrivee: 'Un invité rejoint la soirée',
  ambiance: 'Accueil : musique de fond, en boucle',
  explication: 'Explication animée d’un jeu : musique de fond, en boucle',
};

const estFond = (son: Son): son is Fond => son === 'ambiance' || son === 'explication';

/** Page d'écoute : chaque son de l'écran commun, à juger à l'oreille. */
export default function KitSons() {
  const [lecteur, setLecteur] = useState<Lecteur | null>(null);
  const [volume, setVolume] = useState(80);
  const [fond, setFond] = useState<Fond | null>(null);

  // En veille quand la page se démonte, réveillé sinon (voir `Lecteur.veiller`).
  useEffect(() => {
    lecteur?.veiller(false);
    return () => lecteur?.veiller(true);
  }, [lecteur]);
  useEffect(() => lecteur?.regler({ actif: true, volume }), [lecteur, volume]);
  useEffect(() => lecteur?.fond(fond), [lecteur, fond]);

  if (!lecteur) {
    const activer = async () => {
      // Un écran commun ouvert à côté se tait ; s'il reprend le son, cette page le repropose.
      const neuf = await creerLecteur(
        { actif: true, volume },
        { surCession: () => setLecteur(null) },
      );
      window.__tuLecteur = neuf;
      setLecteur(neuf);
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
            {estFond(son) ? (
              <Button
                variant={fond === son ? 'primary' : 'ghost'}
                aria-pressed={fond === son}
                onClick={() => setFond(fond === son ? null : son)}
              >
                {fond === son ? `Arrêter ${son}` : son}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => lecteur.jouer(son)}>
                {son}
              </Button>
            )}
            <span className="tu-regie__muted">{MOMENTS[son]}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
