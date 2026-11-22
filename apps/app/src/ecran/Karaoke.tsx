'use client';

import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { positionKaraokeMs } from '@teamup/game';
import { contientTamoul, vueKaraoke, type LigneParoles } from '@/lib/paroles';
import { Celebration } from './Celebration';
import { PositionExtraitContexte } from './sons/useSons';

/** Une ligne de paroles : sa langue (pour la police) et sa longueur (pour tenir sur une rangée). */
const attributs = (texte: string) => ({
  lang: contientTamoul(texte) ? 'ta' : 'und',
  style: { '--tu-karaoke-n': Math.max(14, texte.length) } as CSSProperties,
});

/**
 * Le karaoké du Blind test (2026-11-23), plein écran marine : la ligne chantée se remplit à la
 * couleur de l'équipe qui a trouvé, entre la précédente et la suivante. La position vient de ce
 * que joue vraiment le lecteur ; sans son (aperçu de la régie, son pas activé), de l'heure de la
 * base. Le remplissage s'écrit image par image dans une variable CSS, sans rendu React.
 */
export function Karaoke({
  titre,
  artiste,
  equipe,
  points,
  fete,
  paroles,
  debutS,
  ecouteMs,
  chronoDepartMs,
  decalageMs,
}: {
  titre: string | null;
  artiste: string | null;
  equipe: { numero: number; nom: string } | undefined;
  points: number;
  fete: boolean;
  paroles: readonly LigneParoles[];
  debutS: number;
  ecouteMs: number;
  chronoDepartMs: number | null;
  decalageMs: number;
}) {
  const t = useTranslations('ecran.blind');
  const tEcran = useTranslations('ecran');
  const positionExtrait = useContext(PositionExtraitContexte);
  const racine = useRef<HTMLDivElement>(null);
  // Au premier rendu, la position du buzz : le serveur et le navigateur n'ont pas la même heure.
  const [index, setIndex] = useState(
    () => vueKaraoke(paroles, positionKaraokeMs(debutS, { ecouteMs }, 0)).index,
  );

  useEffect(() => {
    let image = 0;
    const suivre = () => {
      const reelle = positionExtrait?.() ?? null;
      const positionMs =
        reelle !== null
          ? reelle * 1000
          : positionKaraokeMs(
              debutS,
              { ecouteMs },
              chronoDepartMs === null ? 0 : Date.now() + decalageMs - chronoDepartMs,
            );
      const vue = vueKaraoke(paroles, positionMs);
      racine.current?.style.setProperty('--tu-karaoke-avance', String(vue.avancement));
      setIndex(vue.index);
      image = requestAnimationFrame(suivre);
    };
    image = requestAnimationFrame(suivre);
    return () => cancelAnimationFrame(image);
  }, [paroles, debutS, ecouteMs, chronoDepartMs, decalageMs, positionExtrait]);

  const precedente = index > 0 ? paroles[index - 1]?.texte : undefined;
  const courante = index >= 0 ? paroles[index]?.texte : undefined;
  const suivante = paroles[index + 1]?.texte;

  return (
    <div
      ref={racine}
      className={cx(
        'tu-stage__body tu-stage-verdict tu-karaoke',
        equipe && teamModifier(equipe.numero),
      )}
      data-scene="blind"
      data-etape="karaoke"
    >
      <header className="tu-karaoke__tete">
        <p className="tu-karaoke__titre" data-testid="blind-reponse">
          {titre ?? '—'}
        </p>
        {artiste && <p className="tu-karaoke__artiste">{artiste}</p>}
        {equipe && (
          <p className="tu-karaoke__equipe" data-testid="blind-verdict">
            {t('trouvePar', { equipe: equipe.nom })} · {tEcran('points', { points })}
          </p>
        )}
      </header>

      {paroles.length === 0 ? (
        <div className="tu-karaoke__lignes">
          <p className="tu-karaoke__ligne tu-karaoke__ligne--courante" data-testid="karaoke-seul">
            {t('chantez')}
          </p>
        </div>
      ) : (
        <div className="tu-karaoke__lignes" data-testid="karaoke-lignes" data-index={index}>
          <p
            className="tu-karaoke__ligne tu-karaoke__ligne--voisine"
            {...(precedente ? attributs(precedente) : {})}
          >
            {precedente ?? ' '}
          </p>
          {courante ? (
            <p
              key={index}
              className="tu-karaoke__ligne tu-karaoke__ligne--courante"
              data-testid="karaoke-ligne"
              {...attributs(courante)}
            >
              <span>{courante}</span>
              <span className="tu-karaoke__rempli" aria-hidden="true">
                {courante}
              </span>
            </p>
          ) : (
            <p
              className="tu-karaoke__ligne tu-karaoke__ligne--courante"
              data-testid="karaoke-attente"
              aria-hidden="true"
            >
              ♪ ♪ ♪
            </p>
          )}
          <p
            className="tu-karaoke__ligne tu-karaoke__ligne--voisine"
            {...(suivante ? attributs(suivante) : {})}
          >
            {suivante ?? ' '}
          </p>
        </div>
      )}

      <div
        className="tu-stage-blind__egaliseur tu-stage-blind__egaliseur--joue tu-karaoke__egaliseur"
        aria-hidden="true"
      >
        {Array.from({ length: 15 }, (_, i) => (
          <span key={i} className="tu-stage-blind__barre" />
        ))}
      </div>
      {fete && <Celebration force={2} />}
    </div>
  );
}
