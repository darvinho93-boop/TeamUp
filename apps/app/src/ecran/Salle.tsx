'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { cx, Wordmark } from '@teamup/ui/react';
import { MESSAGES } from '@/i18n/messages';
import { fondDeLaScene, fondsDuProgramme } from '@/lib/fonds';
import { urlLogo } from '@/lib/logo';
import { FINALE, raccordFinale } from '@/lib/ouverture';
import type { EtatSalle, Scene as NomDeScene } from '@/lib/salle';
import { INTERLUDE_MS, sonsDeLaFinale } from '@/lib/sons';
import { IconeInstagram } from '@/marque/IconeInstagram';
import { INSTAGRAM } from '@/marque/instagram';
import { Pictogramme } from '@/marque/Pictogramme';
import { Ronds } from '@/marque/Ronds';
import { SalleContexte } from './SalleContexte';
import { Habillage } from './Habillage';
import { fondDeRonds } from '@/lib/habillage';
import { Bulles } from './Bulles';
import { FondDeScene } from './FondDeScene';
import { Finale } from './Finale';
import { Scene } from './Scenes';
import { PositionExtraitContexte, SonsContexte, useSons } from './sons/useSons';
import { useFondsDeLaSoiree } from './useFondsDeLaSoiree';
import { useFichiersLocaux } from './useFichiersLocaux';
import { ExtraitsContexte } from './VideoDeScene';
import { extraitsDuProgramme } from '@/lib/extraits';
import { entreeFairePart } from '@/lib/faire-part';
import { EntreeContexte, ThemeContexte, useThemeSoiree } from './faire-part/useThemeSoiree';

/** Après l'entrée à thème, le temps que ses dernières animations se posent. */
const MARGE_ENTREE_MS = 500;

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
  // Le logo du partenaire de la soirée, s'il y en a un : en haut à gauche de toutes les scènes.
  const logoPartenaire = urlLogo(etat.evenement.logo_partenaire);
  // Les photos de fond des jeux, téléchargées d'avance ; celle du jeu en cours, pendant le jeu.
  const fonds = useFondsDeLaSoiree(fondsDuProgramme(etat));
  // Ciné-mime (2026-11-20) : les scènes à jouer, téléchargées dès l'ouverture de l'écran. Pas dans
  // l'aperçu de la régie, qui les lit en flux : une tablette n'a pas à garder cent Mo de vidéos.
  const extraits = useFichiersLocaux('extraits', apercu ? [] : extraitsDuProgramme(etat));
  const fondActuel = fondDeLaScene(etat);
  const urlFond = fondActuel ? (fonds.get(fondActuel) ?? null) : null;
  // Le thème de la soirée (2026-11-27), s'il y en a un : prêt quand tous ses fichiers sont là.
  // L'aperçu de la régie le montre, sans ses musiques.
  const theme = useThemeSoiree(etat.evenement.id, { sons: !apercu });
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  const accueilATheme = theme !== null && scene === 'accueil';
  // L'habillage du plateau (2026-11-19) : actif sauf si la régie l'a retiré, jamais sous une
  // photo de fond, ni sous l'accueil d'une soirée à thème (il a son propre décor).
  const habille = etat.habillage !== false && !urlFond && !accueilATheme;

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
  // L'entrée à thème remplace la passe finale quand le thème est prêt au passage.
  const [entreeThemee, setEntreeThemee] = useState(false);
  // La scène du chargement : vue telle quelle, sans sa cinématique d'arrivée (la clôture).
  const [premiere, setPremiere] = useState(true);
  if (scene !== sceneVue) {
    setSceneVue(scene);
    setPremiere(false);
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
  const jouerFairePartRef = useRef<ReturnType<typeof useSons>['jouerFairePart']>(null);
  useEffect(() => {
    if (!passage) return;
    const { attenteMs, depuisMs: depuis } = raccordFinale(performance.now() - debutBoucle.current);
    // Soirée à thème : l'accueil se forme lui-même, sur la musique de ses hôtes, qui part là où
    // le QR code paraissait. Décidé une fois pour toutes au passage.
    const aTheme = themeRef.current;
    const minutage = aTheme ? entreeFairePart(aTheme.theme.reglages) : null;
    const duree = minutage ? minutage.fin + MARGE_ENTREE_MS : FINALE.fin;
    const debut = setTimeout(() => {
      setDepuisMs(depuis);
      setEntreeThemee(minutage !== null);
      setFinaleDe(passage);
      for (const pas of sonsDeLaFinale(depuis))
        jouerRef.current?.(pas.son, pas.apresMs, undefined, pas.dansLeSonMs);
      if (minutage) jouerFairePartRef.current?.(minutage.notes - depuis);
    }, attenteMs);
    const fin = setTimeout(() => setTermine(passage), attenteMs + duree - depuis);
    return () => {
      clearTimeout(debut);
      clearTimeout(fin);
    };
  }, [passage]);

  // Le son ne sort que de l'écran commun : l'aperçu de la régie reste muet.
  const sons = useSons(etat, apercu, decalageMs, {
    sons: theme?.sons ?? null,
    entreeEnCours: enCours,
  });
  useEffect(() => {
    jouerRef.current = sons.jouer;
    jouerFairePartRef.current = sons.jouerFairePart;
  }, [sons.jouer, sons.jouerFairePart]);
  const entree = useMemo(
    () => (enFinale && entreeThemee ? { depuisMs } : null),
    [enFinale, entreeThemee, depuisMs],
  );

  return (
    <NextIntlClientProvider locale={langue} messages={MESSAGES[langue]}>
      <SonsContexte value={sons.jouer}>
        <PositionExtraitContexte value={sons.positionExtrait}>
          <SalleContexte value={{ apercu, premiere }}>
            <ThemeContexte value={theme}>
              <EntreeContexte value={entree}>
                <ExtraitsContexte value={extraits}>
                  <div
                    className={cx(
                      'tu-stage',
                      apercu && 'tu-stage--apercu',
                      projete && 'tu-stage--projete',
                      logoPartenaire && 'tu-stage--partenaire',
                      fonds.size > 0 && 'tu-stage--fond',
                      habille && 'tu-stage--habillage',
                    )}
                    lang={langue}
                    aria-hidden={apercu || undefined}
                    data-fin-de-boucle={finDeBoucle || undefined}
                    data-d-emblee={premiere || undefined}
                    data-theme-soiree={theme?.theme.theme}
                  >
                    {fonds.size > 0 && <FondDeScene url={urlFond} />}
                    {habille && <Habillage ronds={fondDeRonds(etat)} />}
                    {/* La clé remonte la scène quand elle change, ou le jeu : c'est ce qui la fait fondre. */}
                    <Scene
                      key={`${sceneAffichee}:${mancheId ?? ''}`}
                      etat={
                        finDeBoucle
                          ? { ...etat, pilotage: { ...etat.pilotage, scene: sceneAffichee } }
                          : etat
                      }
                      decalageMs={decalageMs}
                      qrSvg={qrSvg}
                      adresse={adresse}
                    />
                    {/* Le logo du partenaire en haut à gauche, dans la boîte de la marque Team Up! ; le compte
              Instagram descend alors en bas à gauche (2026-11-11). */}
                    {logoPartenaire && (
                      // Fichier du bucket public, déjà à la bonne taille : rien à optimiser côté Next.
                      <img
                        className="tu-logo-partenaire tu-stage__partenaire"
                        src={logoPartenaire}
                        alt={MESSAGES[langue].ecran.partenaire}
                        data-testid="logo-partenaire"
                      />
                    )}
                    {/* Le compte Instagram en haut à gauche, sur toutes les scènes ; le logo animé en haut à
              droite, sauf là où il est déjà en grand (2026-10-22). */}
                    {!PAGES_INSTAGRAM.has(sceneAffichee) &&
                      !(theme && sceneAffichee === 'accueil') && (
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
                    {enFinale && !entreeThemee && <Finale key={passage} depuisMs={depuisMs} />}
                    {/* Les messages des joueurs et de la régie, par-dessus toutes les scènes (2026-11-15) ;
              dans l'aperçu aussi : l'animateur voit ce que voit la salle. */}
                    {etat.messages && (
                      <Bulles
                        messages={etat.messages}
                        decalageMs={decalageMs}
                        // Pendant le quiz, ses cases remplissent la scène : un bandeau en bas, une bulle à
                        // la fois (2026-11-15, vu à 8 équipes).
                        bandeau={
                          (scene === 'jeu' &&
                            etat.programme.find((m) => m.id === mancheId)?.jeu === 'qcm2') ||
                          // Au podium, une bulle cachait « Bravo et merci » (audit du 2026-11-19).
                          scene === 'podium'
                        }
                      />
                    )}
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
                </ExtraitsContexte>
              </EntreeContexte>
            </ThemeContexte>
          </SalleContexte>
        </PositionExtraitContexte>
      </SonsContexte>
    </NextIntlClientProvider>
  );
}
