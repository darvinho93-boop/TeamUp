'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useMessages, useTranslations } from 'next-intl';
import {
  carteA,
  dureeExplicationS,
  scriptExplication,
  SCRIPTS_EXPLICATION,
  type GameCode,
} from '@teamup/game';
import { Button, cx } from '@teamup/ui/react';
import { VisuelCarte } from '@/ecran/explications/Visuels';
import { useEchelleScene } from '@/ecran/useEchelleScene';

/** Le pas de l'horloge du lecteur : la barre d'avancement avance par dixièmes de seconde. */
const PAS_MS = 100;
/** Le décor grandit pour remplir le cadre, sans dépasser deux fois sa taille d'écran. */
const ECHELLE_MAX = 2;

/**
 * La vidéo explicative d'un jeu, sur la carte Team Up! : l'explication animée de l'écran commun
 * (lot 12), rejouée sur le téléphone. Le décor de chaque carte, à sa taille d'écran, est réduit
 * dans un cadre 16:9 (comme l'aperçu de la régie) ; la phrase passe dessous, en sous-titre lisible,
 * dans la langue du téléphone. Le Quiz montre son script de base (`scriptExplication`).
 */
export function VideoJeu({ jeu, fermer }: { jeu: GameCode | null; fermer: () => void }) {
  const dialogue = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogue.current;
    if (!d) return;
    if (jeu && !d.open) d.showModal();
    if (!jeu && d.open) d.close();
  }, [jeu]);

  return (
    <dialog
      ref={dialogue}
      className="tu-carte-dialogue"
      aria-labelledby="titre-video"
      onClose={fermer}
    >
      {jeu && <Lecteur key={jeu} jeu={jeu} fermer={() => dialogue.current?.close()} />}
    </dialog>
  );
}

function Lecteur({ jeu, fermer }: { jeu: GameCode; fermer: () => void }) {
  const t = useTranslations();
  const messages = useMessages();
  const script = scriptExplication(jeu);
  const cartes = SCRIPTS_EXPLICATION[script];
  const dureeMs = dureeExplicationS(script) * 1000;
  const [ecoule, setEcoule] = useState(0);
  const [enLecture, setEnLecture] = useState(true);
  const { index, progression, finie } = carteA(script, ecoule);
  const carte = cartes[index]!;
  const joue = enLecture && !finie;
  const phrases = messages.ecran.explications[script] as Record<string, string>;

  useEffect(() => {
    if (!joue) return;
    const minuterie = setInterval(() => setEcoule((e) => Math.min(e + PAS_MS, dureeMs)), PAS_MS);
    return () => clearInterval(minuterie);
  }, [joue, dureeMs]);

  // La scène, à sa taille d'écran (1 920 × 1 080), réduite à la largeur du cadre.
  const [cadre, echelle] = useEchelleScene('largeur', 0.2);

  // Le décor remplit la scène : on le mesure à sa taille d'écran, puis on l'agrandit jusqu'à
  // toucher un bord (au plus deux fois). Mesures prises dans la scène réduite : seul le rapport
  // compte.
  const carteRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bloc = carteRef.current;
    if (!bloc) return;
    const ajuster = () => {
      const visuel = bloc.firstElementChild;
      if (!visuel) return;
      bloc.style.setProperty('--tu-expl-echelle', '1');
      const v = visuel.getBoundingClientRect();
      const b = bloc.getBoundingClientRect();
      if (!v.width || !v.height) return;
      const ratio = Math.min(b.width / v.width, b.height / v.height, ECHELLE_MAX);
      bloc.style.setProperty('--tu-expl-echelle', String(Math.floor(ratio * 10) / 10));
    };
    ajuster();
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(bloc);
    return () => observateur.disconnect();
  }, [index]);

  const basculer = () => {
    if (finie) {
      setEcoule(0);
      setEnLecture(true);
    } else {
      setEnLecture((l) => !l);
    }
  };

  return (
    <div className="tu-carte-video">
      <div className="tu-carte-video__tete">
        <h2 id="titre-video" className="tu-carte-video__titre">
          {t(`jeux.${jeu}`)}
        </h2>
        <button
          type="button"
          className="tu-carte-video__fermer"
          onClick={fermer}
          aria-label={t('carte.fermer')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div
        ref={cadre}
        className={cx('tu-carte-video__cadre', !joue && 'tu-carte-video__cadre--pause')}
        style={{ '--tu-stage-echelle': echelle } as CSSProperties}
      >
        <div className="tu-stage tu-stage--apercu" aria-hidden="true">
          {/* La clé remonte la carte à chaque changement : ses animations repartent de zéro. */}
          <div ref={carteRef} key={`${script}-${index}`} className="tu-expl__carte">
            <VisuelCarte visuel={carte.visuel} />
          </div>
        </div>
      </div>

      <ol className="tu-carte-video__progression" aria-hidden="true">
        {cartes.map((c, i) => (
          <li key={c.cle} className="tu-carte-video__segment">
            <span
              className="tu-carte-video__plein"
              style={{ transform: `scaleX(${i < index ? 1 : i === index ? progression : 0})` }}
            />
          </li>
        ))}
      </ol>

      <p className="tu-carte-video__phrase" aria-live="polite" data-testid="phrase-video">
        {phrases[carte.cle] ?? ''}
      </p>

      <Button variant="primary" size="lg" block onClick={basculer}>
        <svg className="tu-carte-video__icone" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {finie ? (
            <path d="M4 4v6h6M4.6 15a8 8 0 1 0 1.9-8.3L4 10" />
          ) : joue ? (
            <path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z" fill="currentColor" stroke="none" />
          ) : (
            <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
          )}
        </svg>
        {t(finie ? 'carte.revoir' : joue ? 'carte.pause' : 'carte.lecture')}
      </Button>
    </div>
  );
}
