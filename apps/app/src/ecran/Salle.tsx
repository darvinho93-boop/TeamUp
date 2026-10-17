'use client';

import { useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { cx, Wordmark } from '@teamup/ui/react';
import { MESSAGES } from '@/i18n/messages';
import { REVELATION_MS } from '@/lib/logo-soiree';
import type { EtatSalle } from '@/lib/salle';
import { INTERLUDE_MS } from '@/lib/sons';
import { Pictogramme } from '@/marque/Pictogramme';
import { Revelation } from './Revelation';
import { Scene } from './Scenes';
import { SonsContexte, useSons } from './sons/useSons';

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
}: {
  etat: EtatSalle;
  decalageMs: number;
  qrSvg: string;
  adresse: string;
  /** Rendu réduit dans la régie : même composant, même contenu que l'écran projeté. */
  apercu?: boolean;
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

  // De l'ouverture à l'accueil, la révélation du logo de la soirée passe par-dessus la page du QR
  // code. Seulement si cet écran a vu le passage : ni au chargement, ni dans l'aperçu, ni sans
  // mouvement (on arrive alors directement sur la page).
  const [sceneVue, setSceneVue] = useState(scene);
  const [revelation, setRevelation] = useState(0);
  const [revelee, setRevelee] = useState(0);
  if (scene !== sceneVue) {
    setSceneVue(scene);
    const sansMouvement = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sceneVue === 'ouverture' && scene === 'accueil' && !apercu && !sansMouvement)
      setRevelation((n) => n + 1);
  }
  const enRevelation = revelation > revelee;
  useEffect(() => {
    if (!revelation) return;
    const fin = setTimeout(() => setRevelee(revelation), REVELATION_MS);
    return () => clearTimeout(fin);
  }, [revelation]);

  // Le son ne sort que de l'écran commun : l'aperçu de la régie reste muet.
  const sons = useSons(etat, apercu, decalageMs);

  return (
    <NextIntlClientProvider locale={langue} messages={MESSAGES[langue]}>
      <SonsContexte value={sons.jouer}>
        <div
          className={cx('tu-stage', apercu && 'tu-stage--apercu')}
          lang={langue}
          aria-hidden={apercu || undefined}
        >
          {/* La clé remonte la scène quand elle change, ou le jeu : c'est ce qui la fait fondre. */}
          <Scene
            key={`${scene}:${mancheId ?? ''}`}
            etat={etat}
            decalageMs={decalageMs}
            qrSvg={qrSvg}
            adresse={adresse}
          />
          {scene !== 'accueil' && scene !== 'ouverture' && (
            <span className="tu-marque tu-stage__picto">
              <Pictogramme taille="coin" />
              <Wordmark className="tu-stage__nom" />
            </span>
          )}
          {interlude && (
            <div key={interlude} className="tu-interlude" data-testid="interlude">
              <Pictogramme taille="lg" anime />
            </div>
          )}
          {enRevelation && <Revelation key={revelation} logo={etat.evenement.logo ?? null} />}
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
