'use client';

import { useEffect, useRef, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { cx, Wordmark } from '@teamup/ui/react';
import { MESSAGES } from '@/i18n/messages';
import { FINALE, raccordFinale } from '@/lib/ouverture';
import type { EtatSalle, Scene as NomDeScene } from '@/lib/salle';
import { INTERLUDE_MS, sonsDeLaFinale } from '@/lib/sons';
import { IconeInstagram } from '@/marque/IconeInstagram';
import { INSTAGRAM } from '@/marque/instagram';
import { Pictogramme } from '@/marque/Pictogramme';
import { Ronds } from '@/marque/Ronds';
import { Finale } from './Finale';
import { Scene } from './Scenes';
import { SonsContexte, useSons } from './sons/useSons';

/** Les scènes qui portent déjà le logo en grand, ou l'invitation Instagram en entier. */
const LOGO_EN_GRAND = new Set<NomDeScene>(['ouverture', 'accueil', 'cloture']);
const PAGES_INSTAGRAM = new Set<NomDeScene>(['instagram', 'cloture']);

/**
 * L'écran de la salle, dans la première langue de la soirée quelle que soit celle du navigateur
 * qui l'affiche : c'est la langue de la salle, pas celle de l'animateur. Les contenus, eux, sont
 * dans toutes les langues de la soirée.
 */
export function Salle({
  etat,
  decalageMs,
  qrSvg,
  adresse,
  apercu = false,
  projete = false,
}: {
  etat: EtatSalle;
  decalageMs: number;
  qrSvg: string;
  adresse: string;
  /** Rendu réduit dans la régie : même composant, même contenu que l'écran projeté. */
  apercu?: boolean;
  /** L'écran commun : la scène à sa taille de référence, mise à l'échelle du projecteur. */
  projete?: boolean;
}) {
  const langue = etat.evenement.langues[0] ?? 'fr';
  const { scene, manche_id: mancheId } = etat.pilotage;

  // Entre deux jeux, le logo passe en plein écran, par-dessus une scène déjà à jour. Seulement
  // si cet écran a vu le jeu arriver : ni au chargement, ni dans l'aperçu de la régie.
  const presente = scene === 'intro' ? mancheId : null;
  const [vue, setVue] = useState(presente);
  const [interlude, setInterlude] = useState<string | null>(null);
  if (presente !== vue) {
    setVue(presente);
    if (presente && !apercu) setInterlude(presente);
  }
  useEffect(() => {
    if (!interlude) return;
    const fin = setTimeout(() => setInterlude(null), INTERLUDE_MS);
    return () => clearTimeout(fin);
  }, [interlude]);

  // De l'ouverture à l'accueil, une passe finale forme le logo Team Up! par-dessus la page du QR
  // code, sans couper la cinématique : elle prend la boucle au vol tant qu'elle la suit à
  // l'identique, sinon la boucle va d'abord au bout de son cycle (`raccordFinale`). Seulement si cet écran a vu le passage : ni au chargement, ni dans l'aperçu, ni sans
  // mouvement (on arrive alors directement sur la page). La boucle est en CSS : elle a démarré
  // quand la scène d'ouverture a été montée.
  const debutBoucle = useRef(0);
  useEffect(() => {
    if (scene === 'ouverture') debutBoucle.current = performance.now();
  }, [scene]);
  const [sceneVue, setSceneVue] = useState(scene);
  const [passage, setPassage] = useState(0);
  const [finaleDe, setFinaleDe] = useState(0);
  const [depuisMs, setDepuisMs] = useState(0);
  const [termine, setTermine] = useState(0);
  if (scene !== sceneVue) {
    setSceneVue(scene);
    const sansMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sceneVue === 'ouverture' && scene === 'accueil' && !apercu && !sansMouvement)
      setPassage((n) => n + 1);
  }
  const enCours = scene === 'accueil' && passage > termine;
  const finDeBoucle = enCours && finaleDe < passage;
  const enFinale = enCours && finaleDe === passage;
  const sceneAffichee = finDeBoucle ? 'ouverture' : scene;

  // Les sons partent avec la passe finale, pas au clic : le lecteur du moment, pris au vol.
  const jouerRef = useRef<ReturnType<typeof useSons>['jouer']>(null);
  useEffect(() => {
    if (!passage) return;
    const { attenteMs, depuisMs: depuis } = raccordFinale(performance.now() - debutBoucle.current);
    const debut = setTimeout(() => {
      setDepuisMs(depuis);
      setFinaleDe(passage);
      for (const pas of sonsDeLaFinale(depuis))
        jouerRef.current?.(pas.son, pas.apresMs, undefined, pas.dansLeSonMs);
    }, attenteMs);
    const fin = setTimeout(() => setTermine(passage), attenteMs + FINALE.fin - depuis);
    return () => {
      clearTimeout(debut);
      clearTimeout(fin);
    };
  }, [passage]);

  // Le son ne sort que de l'écran commun : l'aperçu de la régie reste muet.
  const sons = useSons(etat, apercu, decalageMs);
  useEffect(() => {
    jouerRef.current = sons.jouer;
  }, [sons.jouer]);

  return (
    <NextIntlClientProvider locale={langue} messages={MESSAGES[langue]}>
      <SonsContexte value={sons.jouer}>
        <div
          className={cx('tu-stage', apercu && 'tu-stage--apercu', projete && 'tu-stage--projete')}
          lang={langue}
          aria-hidden={apercu || undefined}
          data-fin-de-boucle={finDeBoucle || undefined}
        >
          {/* La clé remonte la scène quand elle change, ou le jeu : c'est ce qui la fait fondre. */}
          <Scene
            key={`${sceneAffichee}:${mancheId ?? ''}`}
            etat={
              finDeBoucle ? { ...etat, pilotage: { ...etat.pilotage, scene: sceneAffichee } } : etat
            }
            decalageMs={decalageMs}
            qrSvg={qrSvg}
            adresse={adresse}
          />
          {/* Le compte Instagram en haut à gauche, sur toutes les scènes ; le logo animé en haut à
              droite, sauf là où il est déjà en grand (2026-10-22). */}
          {!PAGES_INSTAGRAM.has(sceneAffichee) && (
            <span className="tu-stage__insta" data-testid="insta-coin">
              <IconeInstagram />
              {INSTAGRAM.pseudo}
            </span>
          )}
          {!LOGO_EN_GRAND.has(sceneAffichee) && (
            <span className="tu-marque tu-stage__picto">
              <Ronds mode="coin" />
              <Wordmark className="tu-stage__nom" />
            </span>
          )}
          {interlude && (
            <div key={interlude} className="tu-interlude" data-testid="interlude">
              <Pictogramme taille="lg" anime />
            </div>
          )}
          {enFinale && <Finale key={passage} depuisMs={depuisMs} />}
          {sons.aActiver && (
            <button
              type="button"
              className="tu-btn tu-btn--ghost tu-stage__son"
              onClick={() => void sons.activer()}
            >
              {MESSAGES[langue].ecran.activerSon}
            </button>
          )}
        </div>
      </SonsContexte>
    </NextIntlClientProvider>
  );
}
