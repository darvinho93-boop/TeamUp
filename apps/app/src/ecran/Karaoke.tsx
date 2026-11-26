'use client';

import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { positionKaraokeMs } from '@teamup/game';
import { contientTamoul, rangees, vueKaraoke, type LigneParoles } from '@/lib/paroles';
import { Celebration } from './Celebration';
import { PositionExtraitContexte } from './sons/useSons';

/** Une ligne de paroles : sa langue (pour la police) et sa longueur (pour tenir sur une rangée). */
const attributs = (texte: string) => ({
  lang: contientTamoul(texte) ? 'ta' : 'und',
  style: { '--tu-karaoke-n': Math.max(14, texte.length) } as CSSProperties,
});

/** La version en lettres latines (2026-11-26), sous la ligne, réduite pour tenir sur une rangée. */
const attributsLatin = (ligne: LigneParoles) => ({
  lang: contientTamoul(ligne.texte) ? 'ta-Latn' : undefined,
  style: { '--tu-karaoke-n-latin': Math.max(14, ligne.latin?.length ?? 0) } as CSSProperties,
});

/** Une ligne voisine, avec sa version latine dessous s'il y en a une. */
function Voisine({ ligne }: { ligne: LigneParoles | undefined }) {
  return (
    <p
      className="tu-karaoke__ligne tu-karaoke__ligne--voisine"
      {...(ligne ? attributs(ligne.texte) : {})}
    >
      {ligne?.texte ?? ' '}
      {ligne?.latin && (
        <span className="tu-karaoke__latin" {...attributsLatin(ligne)}>
          {ligne.latin}
        </span>
      )}
    </p>
  );
}

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

  const precedente = index > 0 ? paroles[index - 1] : undefined;
  const ligneCourante = index >= 0 ? paroles[index] : undefined;
  const courante = ligneCourante?.texte;
  const suivante = paroles[index + 1];
  const rangeesCourantes = courante ? rangees(courante) : [];
  // Sa plus longue rangée règle la taille de la ligne chantée, et ses voisines restent plus petites.
  const tailleCourante = {
    '--tu-karaoke-n-courant': Math.max(14, ...rangeesCourantes.map((r) => r.texte.length)),
  } as CSSProperties;

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
            {equipe.nom} · {tEcran('points', { points })}
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
        <div
          className="tu-karaoke__lignes"
          style={tailleCourante}
          data-testid="karaoke-lignes"
          data-index={index}
          data-tamoul={courante && contientTamoul(courante) ? true : undefined}
        >
          <Voisine ligne={precedente} />
          {courante ? (
            <p
              key={index}
              className="tu-karaoke__ligne tu-karaoke__ligne--courante"
              data-testid="karaoke-ligne"
              lang={attributs(courante).lang}
            >
              {rangeesCourantes.map((r) => (
                <span
                  key={r.debut}
                  className="tu-karaoke__rangee"
                  style={
                    { '--tu-rangee-debut': r.debut, '--tu-rangee-part': r.part } as CSSProperties
                  }
                >
                  <span>{r.texte}</span>
                  <span className="tu-karaoke__rempli" aria-hidden="true">
                    {r.texte}
                  </span>
                </span>
              ))}
              {/* Elle se remplit sur toute la ligne chantée, pendant que ses rangées tamoules
                  se remplissent l'une après l'autre. */}
              {ligneCourante?.latin && (
                <span
                  className="tu-karaoke__rangee tu-karaoke__latin"
                  data-testid="karaoke-latin"
                  {...attributsLatin(ligneCourante)}
                >
                  <span>{ligneCourante.latin}</span>
                  <span className="tu-karaoke__rempli" aria-hidden="true">
                    {ligneCourante.latin}
                  </span>
                </span>
              )}
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
          <Voisine ligne={suivante} />
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
