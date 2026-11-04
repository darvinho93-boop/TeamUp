'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cx } from '@teamup/ui/react';
import {
  avecCles,
  bienvenueDe,
  nouveauxPrenoms,
  rangeesDe,
  RANGEES_BANDEAU,
  VITESSE_BANDEAU_REM_S,
} from '@/lib/bandeau';
import { useMouvementReduit } from './TirageOrdre';

/** Les derniers arrivés vus par cet écran, numérotés : chaque arrivée relance le message. */
export interface Arrivees {
  n: number;
  nouveaux: string[];
}

/**
 * Les arrivées que cet écran voit se produire : ni au chargement, ni à la relecture d'un état
 * inchangé (comme `useArrivee`).
 */
export function useArrivees(prenoms: readonly string[]): Arrivees | null {
  const cle = prenoms.join('\u0000');
  const [vu, setVu] = useState({ cle, prenoms });
  const [arrivees, setArrivees] = useState<Arrivees | null>(null);
  if (cle !== vu.cle) {
    const nouveaux = nouveauxPrenoms(vu.prenoms, prenoms);
    setVu({ cle, prenoms });
    if (nouveaux.length > 0) setArrivees((a) => ({ n: (a?.n ?? 0) + 1, nouveaux }));
  }
  return arrivees;
}

/**
 * « Bienvenue, Camille ! » sous le compte des joueurs, le temps de le lire. Sa place est réservée :
 * rien ne bouge quand il paraît ; un nom trop long se coupe plutôt que de passer à la ligne.
 */
export function MessageBienvenue({ arrivees }: { arrivees: Arrivees | null }) {
  const t = useTranslations('ecran');
  const langue = useLocale();
  const bienvenue = arrivees ? bienvenueDe(arrivees.nouveaux) : null;
  return (
    <p className="tu-stage-bienvenue" data-testid="bienvenue">
      {arrivees && bienvenue && (
        <span key={arrivees.n} className="tu-stage-bienvenue__texte">
          {bienvenue.autres === 0
            ? t('bienvenue', {
                prenoms: new Intl.ListFormat(langue, { type: 'conjunction' }).format(
                  bienvenue.prenoms,
                ),
              })
            : t('bienvenueEtAutres', {
                prenoms: bienvenue.prenoms.join(', '),
                autres: bienvenue.autres,
              })}
        </span>
      )}
    </p>
  );
}

/**
 * Les prénoms des joueurs déjà arrivés, sous le QR code de l'accueil (2026-11-04) : deux bandeaux
 * qui glissent en sens opposés. Une rangée qui tient dans la largeur reste immobile et centrée ;
 * une rangée qui déborde est doublée et boucle sans fin. Le mouvement est une transformation par
 * image (`requestAnimationFrame`), sans rendu React. Un nouvel arrivé s'ouvre au bout de sa rangée,
 * en surbrillance. Sous `prefers-reduced-motion`, rien ne bouge : les plus récents d'abord.
 */
export function BandeauPrenoms({
  prenoms,
  nouveaux,
}: {
  /** Tous les prénoms, par ordre d'arrivée. */
  prenoms: readonly string[];
  /** Ceux arrivés à la dernière lecture, à mettre en surbrillance. */
  nouveaux: readonly string[];
}) {
  const t = useTranslations('ecran');
  const reduit = useMouvementReduit();
  const liste = avecCles(prenoms);
  const rangees = rangeesDe(reduit ? [...liste].reverse() : liste);

  // Le dernier homonyme de chaque nouveau prénom est le nouvel arrivé.
  const occurrences = new Map<string, number>();
  for (const p of prenoms) occurrences.set(p, (occurrences.get(p) ?? 0) + 1);
  const clesNouvelles = new Set(nouveaux.map((p) => `${p}#${(occurrences.get(p) ?? 1) - 1}`));

  const rangeesRef = useRef<(HTMLDivElement | null)[]>([]);
  const pistesRef = useRef<(HTMLDivElement | null)[]>([]);
  const listesRef = useRef<(HTMLUListElement | null)[]>([]);
  /** La longueur d'un tour (une liste, marges comprises), mesurée hors du rendu. */
  const longueursRef = useRef(Array.from({ length: RANGEES_BANDEAU }, () => 0));
  const [defile, setDefile] = useState(() => Array.from({ length: RANGEES_BANDEAU }, () => false));
  const defileRef = useRef(defile);
  useEffect(() => {
    defileRef.current = defile;
  }, [defile]);

  // Une rangée défile quand sa liste dépasse sa largeur ; mesuré à chaque changement de taille.
  useLayoutEffect(() => {
    const mesurer = () => {
      const suivant = longueursRef.current.map((_, r) => {
        const liste = listesRef.current[r];
        const rangee = rangeesRef.current[r];
        longueursRef.current[r] = liste?.offsetWidth ?? 0;
        return !!liste && !!rangee && liste.offsetWidth > rangee.clientWidth;
      });
      setDefile((d) => (d.every((v, i) => v === suivant[i]) ? d : suivant));
    };
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    for (const el of [...listesRef.current, ...rangeesRef.current]) if (el) observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  useEffect(() => {
    if (reduit) {
      for (const piste of pistesRef.current) if (piste) piste.style.transform = '';
      return;
    }
    const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const vitesse = (VITESSE_BANDEAU_REM_S * remPx) / 1000;
    const decalages = Array.from({ length: RANGEES_BANDEAU }, () => 0);
    let precedent = performance.now();
    let id = requestAnimationFrame(function pas(maintenant) {
      // Un onglet resté en arrière-plan repart d'où il était, sans bond.
      const dt = Math.min(100, maintenant - precedent);
      precedent = maintenant;
      pistesRef.current.forEach((piste, r) => {
        const longueur = longueursRef.current[r] ?? 0;
        if (!piste) return;
        if (!defileRef.current[r] || longueur <= 0) {
          piste.style.transform = '';
          return;
        }
        const decalage = ((decalages[r] ?? 0) + vitesse * dt) % longueur;
        decalages[r] = decalage;
        // Une rangée vers la gauche, l'autre vers la droite.
        const x = r % 2 === 0 ? -decalage : decalage - longueur;
        piste.style.transform = `translateX(${x}px)`;
      });
      id = requestAnimationFrame(pas);
    });
    return () => cancelAnimationFrame(id);
  }, [reduit]);

  return (
    <div
      className="tu-bandeau"
      role="group"
      data-testid="bandeau-prenoms"
      aria-label={t('bandeauPrenoms')}
    >
      {rangees.map((rangee, r) => {
        const prenomsDeLaRangee = () =>
          rangee.map((p) => (
            <li
              key={p.cle}
              className={cx(
                'tu-bandeau__prenom',
                clesNouvelles.has(p.cle) && 'tu-bandeau__prenom--nouveau',
              )}
            >
              {p.prenom}
            </li>
          ));
        return (
          <div
            key={r}
            ref={(el) => {
              rangeesRef.current[r] = el;
            }}
            className="tu-bandeau__rangee"
            data-defile={defile[r] || undefined}
          >
            <div
              ref={(el) => {
                pistesRef.current[r] = el;
              }}
              className="tu-bandeau__piste"
            >
              <ul
                ref={(el) => {
                  listesRef.current[r] = el;
                }}
                className="tu-bandeau__liste"
              >
                {prenomsDeLaRangee()}
              </ul>
              {/* La copie qui fait boucler une rangée trop longue : lue une seule fois. */}
              {defile[r] && !reduit && (
                <ul className="tu-bandeau__liste" aria-hidden="true">
                  {prenomsDeLaRangee()}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
