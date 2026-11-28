'use client';

import { useContext, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { cx } from '@teamup/ui/react';
import { eclatsDesNotes, entreeFairePart } from '@/lib/faire-part';
import type { EtatSalle } from '@/lib/salle';
import { INSTAGRAM } from '@/marque/instagram';
import { Pictogramme } from '@/marque/Pictogramme';
import { Ronds } from '@/marque/Ronds';
import { BandeauPrenoms, MessageBienvenue, useArrivees } from '../BandeauPrenoms';
import { useAnimationsCalees } from '../useAnimationsCalees';
import { EntreeContexte, ThemeContexte, type ThemeCharge } from './useThemeSoiree';

/** Une scène fait 1 920 px de large pour 120 rem : un rem, 16 px de scène. */
const PX_PAR_REM = 16;
const rem = (px: number) => `${px / PX_PAR_REM}rem`;

/**
 * Au premier passage du motif, le logo de la passe finale (pictogramme et nom) se range à droite,
 * là où viendra le QR code, face à la carte qui se dessine : décalage en px de scène et échelle,
 * autour du centre de la scène.
 */
const COTE = { x: 420, echelle: 0.86 } as const;

/** Les éclats des premières notes, autour du pictogramme (px de scène depuis son centre). */
const PLACES_ECLATS = [
  { x: -205, y: -95, t: 42 },
  { x: 192, y: -142, t: 38 },
  { x: -178, y: 58, t: 36 },
  { x: 214, y: 36, t: 48 },
  { x: -6, y: -206, t: 56 },
  { x: 168, y: -200, t: 34 },
] as const;

/**
 * Les éclats des passages du motif (px de scène) : sur la mairie au premier, près du monogramme au
 * deuxième, puis un par temps au troisième, de plus en plus près du point de la bascule.
 */
const ECLATS_DES_PASSAGES = [
  { x: 610, y: 118, t: 60, passage: 0, temps: 0 },
  { x: 700, y: 352, t: 56, passage: 1, temps: 0 },
  { x: 330, y: 540, t: 50, passage: 2, temps: 0 },
  { x: 1530, y: 380, t: 46, passage: 2, temps: 1 },
  { x: 820, y: 830, t: 46, passage: 2, temps: 2 },
  { x: 1065, y: 330, t: 64, passage: 2, temps: 3 },
] as const;

/** Les feuilles qui jaillissent à la bascule : un tirage fixe, le même sur tous les écrans. */
const GERBE = (() => {
  let graine = 7;
  const alea = () => (graine = (graine * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 30 }, (_, i) => {
    const angle = (i / 30) * Math.PI * 2 + (alea() - 0.5) * 0.35;
    const loin = 430 + alea() * 520;
    return {
      teinte: i % 4,
      taille: rem(18 + alea() * 18),
      x: rem(Math.cos(angle) * loin * 1.25),
      y: rem(Math.sin(angle) * loin * 0.85 + 60),
      r0: `${Math.round(alea() * 360)}deg`,
      r1: `${Math.round(alea() * 720 - 360)}deg`,
      duree: `${Math.round(1700 + alea() * 900)}ms`,
      retard: `${Math.round(alea() * 120)}ms`,
    };
  });
})();

/** Les feuilles qui flottent pendant le dernier passage avant l'orchestre : un tirage fixe. */
const FLOTTE = (() => {
  let graine = 11;
  const alea = () => (graine = (graine * 9301 + 49297) % 233280) / 233280;
  return Array.from({ length: 12 }, (_, i) => ({
    teinte: i % 4,
    taille: rem(16 + alea() * 14),
    x: rem(180 + alea() * 1560),
    dx: rem((alea() - 0.5) * 220),
    dy: rem(560 + alea() * 420),
    r0: `${Math.round(alea() * 360)}deg`,
    duree: `${Math.round(4800 + alea() * 2000)}ms`,
    retard: `${Math.round(alea() * 3200)}ms`,
  }));
})();

interface Props {
  etat: EtatSalle;
  qrSvg: string;
  adresse: string;
}

/**
 * L'accueil d'une soirée à thème faire-part (2026-11-27) : à gauche la carte des hôtes (leur
 * illustration, leur monogramme, leurs prénoms, la date), à droite l'encadré du QR code, les
 * prénoms des inscrits en bas. Mêmes données et mêmes repères de test que l'accueil habituel.
 *
 * Vue au passage de l'ouverture (`EntreeContexte`), elle s'y forme, sur la musique des hôtes jouée
 * telle quelle (maquette D v6, 2026-11-27) : la passe finale classique (les ronds, le logo, son
 * nom) ; quand le reel s'est éteint, les premières notes sous une lueur ; à chacun des trois
 * passages du motif qui précèdent l'orchestre, un élément de plus (le logo se range à droite et la
 * mairie se dessine en traits d'or ; elle prend ses couleurs avec le monogramme ; les prénoms, la
 * date, des feuilles qui flottent) ; la bascule quand l'orchestre entre (le papier se répand, les
 * feuilles jaillissent, le logo prend leurs couleurs, Team Up! × leur carte) ; puis un élément par
 * temps jusqu'au QR code. Tout en CSS (`faire-part.css`), délais comptés depuis le début de la
 * passe finale (`entreeFairePart`).
 */
export function AccueilFairePart({ etat, qrSvg, adresse }: Props) {
  const charge = useContext(ThemeContexte) as ThemeCharge;
  const entree = useContext(EntreeContexte);
  const t = useTranslations('ecran');
  const prenoms = etat.prenoms;
  const arrivees = useArrivees(prenoms ?? []);
  const { theme, url, illustration } = charge;
  const racine = useRef<HTMLDivElement>(null);

  // Le pictogramme part de celui de la passe finale, se range à droite avec le nom, puis dans le
  // coin : ses places se mesurent, en px de scène (la scène est mise à l'échelle du projecteur).
  // La lueur part du logo ; l'éclat, l'onde, la gerbe et le × de la bascule, du milieu entre la
  // carte et le logo rangé.
  useLayoutEffect(() => {
    const scene = racine.current;
    if (!entree || !scene) return;
    const boite = scene.getBoundingClientRect();
    const k = boite.width / scene.offsetWidth || 1;
    const centre = (el: Element | null) => {
      const b = el?.getBoundingClientRect();
      if (!b) return null;
      return {
        x: (b.left + b.width / 2 - boite.left) / k,
        y: (b.top + b.height / 2 - boite.top) / k,
        cote: b.width / k,
      };
    };
    const depart = centre(scene.querySelector('.tu-fp-ronds .tu-ronds__logo .tu-picto'));
    const arrivee = centre(scene.querySelector('.tu-fp-marque .tu-picto'));
    const illustration = scene.querySelector('.tu-fp-illustration')?.getBoundingClientRect();
    const vol = scene.querySelector<HTMLElement>('.tu-fp-vol');
    if (!depart || !arrivee || !illustration || !vol) return;
    // Le pictogramme de la passe finale est encore réduit à l'arrivée (ses images clés) : sa
    // place se déduit de son centre, qui ne bouge pas, et de sa taille d'arrivée.
    const cote = vol.offsetWidth;
    const x0 = depart.x - cote / 2;
    const y0 = depart.y - cote / 2;
    // Rangé : le même déplacement que le logo de la passe finale, autour du centre de la scène.
    const cx = scene.offsetWidth / 2;
    const cy = scene.offsetHeight / 2;
    const x1 = cx + COTE.x + COTE.echelle * (x0 - cx);
    const y1 = cy + COTE.echelle * (y0 - cy);
    const ox = ((illustration.right - boite.left) / k + x1) / 2;
    const oy = y1 + (cote * COTE.echelle) / 2;
    const reglages: Record<string, string> = {
      '--tu-fp-hx': rem(depart.x),
      '--tu-fp-hy': rem(depart.y),
      '--tu-fp-ox': rem(ox),
      '--tu-fp-oy': rem(oy),
      '--tu-fp-dhx': rem(ox - depart.x),
      '--tu-fp-dhy': rem(oy - depart.y),
      '--tu-fp-x0': rem(x0),
      '--tu-fp-y0': rem(y0),
      '--tu-fp-x1': rem(x1),
      '--tu-fp-y1': rem(y1),
      '--tu-fp-x2': rem(arrivee.x - arrivee.cote / 2),
      '--tu-fp-y2': rem(arrivee.y - arrivee.cote / 2),
      '--tu-fp-s2': String(arrivee.cote / cote),
    };
    for (const [nom, valeur] of Object.entries(reglages)) scene.style.setProperty(nom, valeur);
  }, [entree]);
  // Ses délais se comptent depuis le début de l'entrée, comme les sons : pas depuis la fin de son
  // premier rendu, lourd (2026-11-28).
  useAnimationsCalees(racine, entree?.debutMs ?? null);

  const minutage = entreeFairePart(theme.reglages);
  const depuis = entree?.depuisMs ?? 0;
  const ms = (instant: number) => `${instant - depuis}ms`;
  const style = {
    '--tu-fp-grain': `url(${url(theme.fichiers.grain)})`,
    '--tu-fp-rinceau-image': `url(${url(theme.fichiers.rinceau)})`,
    '--tu-fp-mh-image': `url(${url(theme.fichiers.monogramme)})`,
    ...(entree && {
      '--tu-finale-depuis': `${depuis}ms`,
      '--tu-fp-cote-x': rem(COTE.x),
      '--tu-fp-s1': String(COTE.echelle),
      '--tu-fp-temps': `${minutage.temps}ms`,
      '--tu-fp-n': ms(minutage.notes),
      '--tu-fp-p1': ms(minutage.passages[0]),
      '--tu-fp-p2': ms(minutage.passages[1]),
      '--tu-fp-p3': ms(minutage.passages[2]),
      '--tu-fp-b': ms(minutage.bascule),
      '--tu-fp-a-coin': ms(minutage.coin),
      '--tu-fp-a-encadre': ms(minutage.encadre),
      '--tu-fp-a-qr': ms(minutage.qr),
      '--tu-fp-a-textes': ms(minutage.textes),
      '--tu-fp-a-compte': ms(minutage.compte),
    }),
  } as CSSProperties;

  return (
    <div
      ref={racine}
      className={cx('tu-stage__body tu-fp-accueil', entree && 'tu-fp-accueil--entree')}
      data-scene="accueil"
      data-theme-soiree="faire-part"
      data-depuis={entree ? depuis : undefined}
      style={style}
    >
      {/* Le papier qui se répand à la bascule, sous le fond qui le relaie (faire-part.css). */}
      {entree && <div className="tu-fp-vague" />}
      <div className="tu-fp-fond" />
      {entree && (
        <>
          <div className="tu-fp-ronds">
            <Ronds mode="finale" />
          </div>
          <div className="tu-fp-halo" />
          <div className="tu-fp-scintillements">
            {eclatsDesNotes(theme.reglages).map((a, i) => {
              const place = PLACES_ECLATS[i % PLACES_ECLATS.length]!;
              return (
                <i
                  key={a}
                  style={
                    {
                      '--tu-fp-dx': rem(place.x),
                      '--tu-fp-dy': rem(place.y),
                      '--tu-fp-t': rem(place.t),
                      '--tu-fp-quand': ms(a),
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
          <div className="tu-fp-scintillements tu-fp-scintillements--passages">
            {ECLATS_DES_PASSAGES.map((e) => (
              <i
                key={`${e.passage}-${e.temps}`}
                style={
                  {
                    '--tu-fp-sx': rem(e.x),
                    '--tu-fp-sy': rem(e.y),
                    '--tu-fp-t': rem(e.t),
                    '--tu-fp-quand': ms(minutage.passages[e.passage] + e.temps * minutage.temps),
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className="tu-fp-eclat" />
          <div className="tu-fp-onde" />
        </>
      )}
      <div className="tu-fp-rinceau tu-fp-rinceau--g" />
      <div className="tu-fp-rinceau tu-fp-rinceau--d" />
      {entree && (
        <>
          <div className="tu-fp-rinceau-cache tu-fp-rinceau-cache--g" />
          <div className="tu-fp-rinceau-cache tu-fp-rinceau-cache--d" />
        </>
      )}
      <p className="tu-fp-insta" data-testid="insta-coin">
        {INSTAGRAM.pseudo}
      </p>
      <p className="tu-fp-marque">
        <Pictogramme taille="coin" teinte />
        Team Up!
      </p>
      {entree && <p className="tu-fp-croix">×</p>}
      <div className="tu-fp-carte">
        <div className="tu-fp-illustration">
          <div dangerouslySetInnerHTML={{ __html: illustration }} />
          {/* Pendant l'entrée, l'illustration en couleurs relaie en fondu le dessin d'or : un fondu
              d'image au lieu de 300 traits recolorés un à un. En image, un SVG n'exécute rien. */}
          {entree && (
            <img
              className="tu-fp-illustration__couleurs"
              src={url(theme.fichiers.illustration)}
              alt=""
            />
          )}
        </div>
        <div className="tu-fp-mh-place">
          {/* Fichiers du thème, déjà téléchargés (`blob:`) : rien à optimiser côté Next. */}
          <img className="tu-fp-mh" src={url(theme.fichiers.monogramme)} alt="" />
        </div>
        <img className="tu-fp-prenoms" src={url(theme.fichiers.prenoms)} alt="" />
        <p className="tu-fp-date">{theme.reglages.date}</p>
      </div>
      <div className="tu-fp-encadre">
        <p className="tu-fp-titre" data-testid="scannez">
          {t('scannez')}
        </p>
        <div className="tu-fp-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="tu-fp-puis">{t('puisPrenom')}</p>
        <p className="tu-fp-lien">
          {t('ouLien')}{' '}
          <b data-testid="lien">
            {adresse}/<span data-testid="code">{etat.evenement.code}</span>
          </b>
        </p>
        <p className="tu-fp-compte" data-testid="joueurs">
          <i className="tu-fp-feuille" aria-hidden="true" />
          {t('joueurs', { n: etat.joueurs })}
        </p>
        {prenoms && <MessageBienvenue arrivees={arrivees} />}
      </div>
      {prenoms && prenoms.length > 0 && (
        <div className="tu-fp-bandeau">
          <BandeauPrenoms prenoms={prenoms} nouveaux={arrivees?.nouveaux ?? []} />
        </div>
      )}
      {entree && (
        <>
          <div className="tu-fp-vol" aria-hidden="true">
            <Pictogramme taille="lg" teinte />
          </div>
          <div className="tu-fp-flotte" aria-hidden="true">
            {FLOTTE.map((f, i) => (
              <i
                key={i}
                className={`tu-fp-flotte__feuille tu-fp-feuille-teinte--${f.teinte}`}
                style={
                  {
                    '--tu-fp-f': f.taille,
                    '--tu-fp-fx': f.x,
                    '--tu-fp-gx': f.dx,
                    '--tu-fp-gy': f.dy,
                    '--tu-fp-r0': f.r0,
                    '--tu-fp-duree': f.duree,
                    '--tu-fp-retard': f.retard,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className="tu-fp-gerbe" aria-hidden="true">
            {GERBE.map((f, i) => (
              <i
                key={i}
                className={`tu-fp-gerbe__feuille tu-fp-feuille-teinte--${f.teinte}`}
                style={
                  {
                    '--tu-fp-f': f.taille,
                    '--tu-fp-gx': f.x,
                    '--tu-fp-gy': f.y,
                    '--tu-fp-r0': f.r0,
                    '--tu-fp-r1': f.r1,
                    '--tu-fp-duree': f.duree,
                    '--tu-fp-retard': f.retard,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
