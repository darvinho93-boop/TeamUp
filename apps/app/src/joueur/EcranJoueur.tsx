'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cx } from '@teamup/ui/react';
import { memoriserLangue } from '@/lib/langue-navigateur';
import type { EtatJoueur, GroupePublic, Langue } from '@/lib/partie';
import { prioriteDuDirect, type JeuEnDirect } from '@/lib/priorite';
import { AjoutInvite } from './AjoutInvite';
import { AvisJoueur } from './AvisJoueur';
import { BlindTest } from './BlindTest';
import { Cadre } from './Cadre';
import { CarteJoueur } from './CarteJoueur';
import { ChoixLangueJoueur } from './ChoixLangueJoueur';
import { Explication } from './Explication';
import { MaPartie } from './MaPartie';
import { MessageEcran } from './MessageEcran';
import { NavigationJoueur, type Onglet } from './NavigationJoueur';
import { NomEquipe } from './NomEquipe';
import { NomPropose } from './NomPropose';
import { OngletClassement } from './OngletClassement';
import { OngletEquipe } from './OngletEquipe';
import { Photos } from './Photos';
import { Portrait } from './Portrait';
import { Quiz } from './Quiz';
import { SurenchereMots } from './SurenchereMots';
import { Tournoi } from './Tournoi';
import { useEtatJoueur } from './useEtatJoueur';
import { useFilePhotos } from './useFilePhotos';

/** Ce qui s'ouvre par-dessus un onglet ; un brouillon y survit à une manche qui prend la main. */
export type Outil = 'carte' | 'avis' | 'photos' | 'ajout' | 'nom' | 'propose';

/**
 * Le joueur est inscrit : une barre de navigation, et l'arbitrage du direct (parcours joueur,
 * 2026-11-23). Quand la régie attend ce joueur (`prioriteDuDirect`), la manche passe devant
 * l'onglet, le formulaire ou la boîte ouverts, sans leur faire perdre leur saisie.
 */
export function EcranJoueur({
  code,
  etatInitial,
  groupes = [],
}: {
  code: string;
  etatInitial: EtatJoueur;
  /** Les groupes de la soirée : un invité ajouté depuis ce téléphone peut en choisir un. */
  groupes?: GroupePublic[];
}) {
  const t = useTranslations();
  const { etat, horsLigne, aJour, decalageMs, remplacer, relire } = useEtatJoueur(
    code,
    etatInitial,
  );
  const [onglet, setOnglet] = useState<Onglet>('partie');
  const [outil, setOutil] = useState<Outil | null>(null);
  // Les outils ouverts et pas refermés : ils restent montés, donc leur saisie reste.
  const [brouillons, setBrouillons] = useState<Outil[]>([]);
  // La file vit ici, pas dans la vue Photos : elle se vide même quand le capitaine en sort.
  const file = useFilePhotos(code, remplacer);
  const router = useRouter();
  const vueDuJeu = useRef<HTMLDivElement>(null);

  // L'heure de la base : la fin d'un chrono rend la navigation sans attendre une relecture.
  const [horloge, setHorloge] = useState(0);
  const heureDeLEtat =
    etat.quiz?.serveur_ms ?? etat.surenchere?.serveur_ms ?? etat.portrait?.serveur_ms ?? 0;
  const priorite = prioriteDuDirect(etat, Math.max(heureDeLEtat, horloge + decalageMs));
  const { jeu, urgent, finMs } = priorite;
  useEffect(() => {
    if (finMs === null) return;
    const attente = Math.max(0, finMs - (Date.now() + decalageMs)) + 50;
    const minuterie = setTimeout(() => setHorloge(Date.now()), attente);
    return () => clearTimeout(minuterie);
  }, [finMs, decalageMs]);

  // La manche prend la main : on revient sur « Ma partie », le formulaire ouvert est suspendu.
  const [etaitUrgent, setEtaitUrgent] = useState(false);
  if (urgent !== etaitUrgent) {
    setEtaitUrgent(urgent);
    if (urgent) {
      setOnglet('partie');
      setOutil(null);
    }
  }
  useEffect(() => {
    const vue = vueDuJeu.current;
    if (!urgent || !vue || vue.contains(document.activeElement)) return;
    window.scrollTo({ top: 0 });
    vue.focus({ preventScroll: true });
  }, [urgent]);

  // Changer de langue en cours de soirée : la fiche du joueur d'abord (ses contenus suivent),
  // puis le cookie et les textes de l'écran.
  const changerLangue = async (langue: Langue) => {
    memoriserLangue(langue);
    try {
      const reponse = await fetch(`/api/partie/${code}/langue`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ langue }),
      });
      if (reponse.ok) remplacer((await reponse.json()) as EtatJoueur);
    } catch {
      // Hors ligne : la page garde la langue de la fiche, on pourra réessayer.
    }
    router.refresh();
  };

  const { joueur, equipe, evenement, photos } = etat;
  const ouverte = evenement.statut !== 'termine';
  const messagesOuverts = evenement.messages_ouverts === true && ouverte;
  const avisOuverts = evenement.avis_ouverts === true;
  const cartesActives = etat.carte !== undefined && ouverte;
  const peutRenommer = joueur.capitaine && !!equipe && !equipe.nom_fige && ouverte;
  // Un droit retiré pendant la saisie ferme l'outil de lui-même.
  const accessibles: Record<Outil, boolean> = {
    carte: cartesActives,
    avis: avisOuverts,
    photos: !!photos && !!equipe,
    ajout: joueur.peut_ajouter && ouverte,
    nom: peutRenommer,
    propose: joueur.volontaire === true && !equipe,
  };
  const outilActif = outil && accessibles[outil] ? outil : null;

  const ouvrirOutil = (choisi: Outil) => {
    setBrouillons((avant) => (avant.includes(choisi) ? avant : [...avant, choisi]));
    setOutil(choisi);
    window.scrollTo({ top: 0 });
  };
  const fermerOutil = (ferme: Outil) => {
    setBrouillons((avant) => avant.filter((o) => o !== ferme));
    setOutil(null);
    window.scrollTo({ top: 0 });
  };
  const allerA = (suivant: Onglet) => {
    setOnglet(suivant);
    setOutil(null);
    window.scrollTo({ top: 0 });
  };

  const formulaire = (o: Outil) => {
    const retour = () => fermerOutil(o);
    switch (o) {
      case 'carte':
        return (
          <CarteJoueur
            code={code}
            prenom={joueur.prenom}
            carte={etat.carte ?? null}
            remplacer={remplacer}
            retour={retour}
          />
        );
      case 'avis':
        return (
          <AvisJoueur code={code} avis={etat.avis ?? null} remplacer={remplacer} retour={retour} />
        );
      case 'photos':
        return (
          photos && (
            <div className="tu-player__body">
              <Photos
                photos={photos}
                capitaine={joueur.capitaine}
                sorts={file.sorts}
                apercus={file.apercus}
                ajouter={file.ajouter}
                retour={retour}
              />
            </div>
          )
        );
      case 'ajout':
        return <AjoutInvite code={code} groupes={groupes} retour={retour} />;
      case 'nom':
        return (
          equipe && (
            <NomEquipe code={code} nomActuel={equipe.nom} remplacer={remplacer} retour={retour} />
          )
        );
      case 'propose':
        return (
          <NomPropose
            code={code}
            nomActuel={joueur.nom_propose ?? ''}
            remplacer={remplacer}
            retour={retour}
          />
        );
    }
  };

  const montrerJeu = urgent || (onglet === 'partie' && !outilActif);

  return (
    <Cadre
      bandeau={
        horsLigne ? (
          <p className="tu-banner" role="status">
            {t('horsLigne.bandeau')}
          </p>
        ) : null
      }
      outil={
        <ChoixLangueJoueur
          langues={evenement.langues}
          choisir={(langue) => void changerLangue(langue)}
        />
      }
      // Pas de barre sur un formulaire : revenue à la fermeture du clavier, elle passait sous le
      // doigt et avalait l'appui sur « Enregistrer » (vu en e2e le 2026-11-23).
      navigation={
        urgent || outilActif ? null : (
          <NavigationJoueur onglet={onglet} choisir={allerA} messages={messagesOuverts} />
        )
      }
    >
      {jeu && (
        // Toujours monté : une mise ou un mot en cours d'envoi survit à un changement d'onglet.
        // Au retour d'une veille, `inert` retient toute action jusqu'à la relecture de l'état.
        <div
          ref={vueDuJeu}
          className={cx('tu-player__vue', !urgent && 'tu-player__vue--compacte')}
          hidden={!montrerJeu}
          tabIndex={-1}
          inert={!aJour}
          aria-busy={!aJour}
          data-testid="vue-du-jeu"
          data-urgent={urgent}
        >
          <div className="tu-player__body">
            <VueDuJeu
              jeu={jeu}
              code={code}
              etat={etat}
              decalageMs={decalageMs}
              remplacer={remplacer}
              relire={relire}
            />
          </div>
        </div>
      )}

      {brouillons
        .filter((o) => accessibles[o])
        .map((o) => (
          <div key={o} className="tu-player__vue" hidden={urgent || outilActif !== o}>
            {formulaire(o)}
          </div>
        ))}

      {!urgent && !outilActif && onglet === 'partie' && (
        <MaPartie
          etat={etat}
          avecJeu={jeu !== null}
          cartesActives={cartesActives}
          avisOuverts={avisOuverts}
          allerA={allerA}
          ouvrirOutil={ouvrirOutil}
        />
      )}
      {!urgent && !outilActif && onglet === 'jeux' && (
        <Explication
          programme={etat.programme ?? []}
          {...(equipe ? { voirEquipe: () => allerA('equipe') } : {})}
        />
      )}
      {!urgent && !outilActif && onglet === 'equipe' && (
        <OngletEquipe etat={etat} peutRenommer={peutRenommer} ouvrirOutil={ouvrirOutil} />
      )}
      {!urgent && !outilActif && onglet === 'classement' && <OngletClassement etat={etat} />}

      {/* Monté tant que les envois sont ouverts : le brouillon du message survit à une manche. */}
      {messagesOuverts && <MessageEcran code={code} suspendu={urgent} />}
    </Cadre>
  );
}

/** Le jeu en cours : les vues de chaque jeu, inchangées, avec leurs droits de capitaine. */
function VueDuJeu({
  jeu,
  code,
  etat,
  decalageMs,
  remplacer,
  relire,
}: {
  jeu: JeuEnDirect;
  code: string;
  etat: EtatJoueur;
  decalageMs: number;
  remplacer: (etat: EtatJoueur) => void;
  relire: () => void;
}) {
  if (jeu === 'quiz' && etat.quiz) {
    return (
      <Quiz
        code={code}
        quiz={etat.quiz}
        decalageMs={decalageMs}
        remplacer={remplacer}
        relire={relire}
      />
    );
  }
  if (jeu === 'surenchere' && etat.surenchere) {
    return (
      <SurenchereMots
        code={code}
        surenchere={etat.surenchere}
        decalageMs={decalageMs}
        remplacer={remplacer}
        relire={relire}
      />
    );
  }
  if (jeu === 'blind' && etat.blind) {
    return (
      <BlindTest
        code={code}
        blind={etat.blind}
        capitaine={etat.joueur.capitaine}
        remplacer={remplacer}
        relire={relire}
      />
    );
  }
  if (jeu === 'portrait' && etat.portrait) {
    return <Portrait code={code} portrait={etat.portrait} remplacer={remplacer} relire={relire} />;
  }
  if (jeu === 'tournoi' && etat.tournoi) return <Tournoi tournoi={etat.tournoi} />;
  return null;
}
