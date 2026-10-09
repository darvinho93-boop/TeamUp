'use client';

import { useEffect, useState } from 'react';
import { Button } from '@teamup/ui/react';
import { SONS, type Son } from '@/lib/sons';
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

/** Page d'écoute : chaque son de l'écran commun, à juger à l'oreille. */
export default function KitSons() {
  const [lecteur, setLecteur] = useState<Lecteur | null>(null);
  const [volume, setVolume] = useState(80);
  const [ambiance, setAmbiance] = useState(false);

  useEffect(() => () => lecteur?.fermer(), [lecteur]);
  useEffect(() => lecteur?.regler({ actif: true, volume }), [lecteur, volume]);
  useEffect(() => lecteur?.ambiance(ambiance), [lecteur, ambiance]);

  if (!lecteur) {
    return (
      <main className="tu-regie__main tu-regie__main--narrow">
        <h1 className="tu-regie__title">Sons de l’écran commun</h1>
        <p>Le navigateur demande un clic avant de jouer du son.</p>
        <Button
          onClick={() =>
            void creerLecteur({ actif: true, volume }).then((neuf) => setLecteur(neuf))
          }
        >
          Activer le son
        </Button>
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
            {son === 'ambiance' ? (
              <Button
                variant={ambiance ? 'primary' : 'ghost'}
                aria-pressed={ambiance}
                onClick={() => setAmbiance(!ambiance)}
              >
                {ambiance ? 'Arrêter l’ambiance' : 'ambiance'}
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
