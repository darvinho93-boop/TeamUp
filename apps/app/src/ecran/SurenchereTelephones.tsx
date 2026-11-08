'use client';

import { useRef, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { grilleDesEquipes } from '@/lib/membres';
import { classementDuTheme, equipesEnJeu, motsAffiches } from '@/lib/mots';
import { texteParLangue, type EtatSalle, type PassageSalle } from '@/lib/salle';
import { Celebration, useArrivee } from './Celebration';
import { Chrono, useMaintenant } from './Chrono';
import { Multilingue } from './Multilingue';
import { Recompense } from './Recompense';
import { useAjusterTexte } from './useAjusterTexte';
import { useTenirEnLargeur } from './useTenirEnLargeur';

/**
 * Surenchère en mode téléphones (2026-11-08), un thème à l'écran commun :
 * - `sujet` : le sujet en grand, « Capitaines, à vos téléphones ! » ;
 * - `chrono` : le sujet, le chrono et le nombre de mots de chaque équipe en direct, jamais les
 *   mots eux-mêmes (la base ne les donne pas) ;
 * - à la fin du chrono (la base les donne alors), puis au `podium` : une carte par équipe avec
 *   tous ses mots, d'un coup ; un mot rayé par l'animateur est barré, le compteur ne compte que
 *   les autres ; au podium, médailles et points sur les cartes, qui restent à leur place.
 */
export function SurenchereTelephones({
  etat,
  decalageMs,
  passage,
  chronoS,
}: {
  etat: EtatSalle;
  decalageMs: number;
  passage: PassageSalle;
  chronoS: number;
}) {
  const t = useTranslations('ecran');
  const { etape, chrono_depart_ms: depart, chrono_duree_s: duree } = etat.pilotage;
  const langues = etat.evenement.langues;
  const equipes = equipesEnJeu(etat);
  const mots = passage.mots ?? {};
  const maintenant = useMaintenant(etape === 'chrono') + decalageMs;
  const fini = depart !== null && maintenant >= depart + (duree ?? chronoS) * 1000;
  const listes = etape === 'podium' || (etape === 'chrono' && motsAffiches(passage));
  const podium = etape === 'podium';
  const classement = podium ? classementDuTheme(passage) : null;
  const fete = useArrivee(podium);

  const corps = useRef<HTMLDivElement>(null);
  const grille = useRef<HTMLUListElement>(null);
  const cle = `${passage.id}:${etape}:${listes}:${langues.join()}:${Object.values(mots)
    .map((m) => `${m.valides}/${m.liste?.length ?? '-'}`)
    .join()}`;
  useAjusterTexte(corps, cle, '--tu-surenchere-echelle');
  useAjusterTexte(grille, cle, '--tu-mots-echelle');
  useTenirEnLargeur(grille, cle, '.tu-stage-team__nom', 0.5);

  const sujet = (
    <Multilingue
      testId="sujet"
      className="tu-stage-multi--geant"
      textes={texteParLangue(passage.secret, 'sujet', langues)}
    />
  );

  if (!listes) {
    return (
      <div
        ref={corps}
        className="tu-stage__body tu-stage-surenchere"
        data-scene="enchere2"
        data-mode="telephones"
        data-etape={etape ?? ''}
      >
        <Multilingue
          className="tu-stage-multi--titre"
          textes={texteParLangue(passage.public, 'theme', langues)}
        />
        <div className="tu-stage-centre tu-stage-reveal">
          <p className="tu-stage__m tu-stage__muted">{t('sujet')}</p>
          {sujet}
          {etape === 'sujet' && (
            <p className="tu-stage__xl" data-testid="capitaines">
              {t('surenchereMots.capitaines')}
            </p>
          )}
          {etape === 'chrono' &&
            (fini ? (
              <p className="tu-stage__xl" data-testid="temps-ecoule">
                {t('surenchereMots.tempsEcoule')}
              </p>
            ) : (
              <Chrono
                departMs={depart}
                dureeS={duree ?? chronoS}
                decalageMs={decalageMs}
                className="tu-stage__giant"
              />
            ))}
        </div>
        {etape === 'chrono' && (
          <ul className="tu-stage-compteurs" data-testid="compteurs">
            {equipes.map((e) => (
              <li
                key={e.id}
                className={cx('tu-stage-compteur', teamModifier(e.numero))}
                data-testid={`compteur-${e.numero}`}
              >
                <span className="tu-stage-compteur__nom">{e.nom}</span>
                <span className="tu-stage-compteur__n">
                  {t('surenchereMots.mots', { n: mots[String(e.numero)]?.valides ?? 0 })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const { colonnes, rangees } = grilleDesEquipes(equipes.length);
  // La taille de départ suit la plus longue liste : peu de mots, grands ; beaucoup, plus petits.
  // L'écran la réduit ensuite jusqu'à ce que tout tienne (`--tu-mots-echelle`).
  const plusLongue = Math.max(0, ...equipes.map((e) => mots[String(e.numero)]?.liste?.length ?? 0));
  const taille = plusLongue <= 8 ? '4xl' : plusLongue <= 20 ? '3xl' : '2xl';
  return (
    <div
      className="tu-stage__body tu-stage-mots"
      data-scene="enchere2"
      data-mode="telephones"
      data-etape={podium ? 'podium' : 'mots'}
    >
      <div ref={corps} className="tu-stage-surenchere tu-stage-mots__tete">
        <Multilingue
          className="tu-stage-multi--titre"
          textes={texteParLangue(passage.secret, 'sujet', langues)}
        />
      </div>
      <ul
        ref={grille}
        className={cx(
          'tu-stage-teams tu-stage-teams--scene tu-stage-mots__grille',
          `tu-stage-teams--${colonnes}`,
          rangees === 2 && 'tu-stage-teams--2-rangees',
        )}
        style={{ '--tu-mot-taille': `var(--tu-size-${taille})` } as CSSProperties}
        data-testid="listes"
      >
        {equipes.map((e) => {
          const leurs = mots[String(e.numero)];
          const rang = classement?.rangs[e.numero];
          const place = rang === 1 || rang === 2 || rang === 3 ? rang : null;
          return (
            <li
              key={e.id}
              className={cx(
                'tu-stage-team tu-stage-mots__carte',
                teamModifier(e.numero),
                place && 'tu-stage-mots__carte--podium',
              )}
              data-testid={`mots-${e.numero}`}
            >
              <span className="tu-stage-team__tete">
                <span className="tu-stage-team__nom">{e.nom}</span>
                <span className="tu-stage-team__nombre" data-testid={`nombre-${e.numero}`}>
                  {t('surenchereMots.mots', { n: leurs?.valides ?? 0 })}
                </span>
              </span>
              {place && (
                <span className="tu-stage-mots__podium" data-testid={`place-${e.numero}`}>
                  <Recompense place={place} />
                  {t('surenchereMots.place', { rang: place })} ·{' '}
                  {t('surenchereMots.points', { points: classement?.points[e.numero] ?? 0 })}
                </span>
              )}
              <ul className="tu-stage-mots__liste">
                {(leurs?.liste ?? []).map((m) => (
                  <li key={m.id} className={cx('tu-stage-mot', m.refuse && 'tu-stage-mot--refuse')}>
                    {m.mot}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
      {fete && <Celebration force={2} />}
    </div>
  );
}
