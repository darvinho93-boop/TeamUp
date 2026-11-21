'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, cx, teamModifier } from '@teamup/ui/react';
import { memoriserLangue } from '@/lib/langue-navigateur';
import { trierMembres } from '@/lib/membres';
import type { EtatJoueur, GroupePublic, Langue } from '@/lib/partie';
import { AjoutInvite } from './AjoutInvite';
import { AvisJoueur } from './AvisJoueur';
import { CarteJoueur } from './CarteJoueur';
import { Cadre } from './Cadre';
import { ChoixLangueJoueur } from './ChoixLangueJoueur';
import { Explication } from './Explication';
import { MessageEcran, ouvrirMessageEcran } from './MessageEcran';
import { NomEquipe } from './NomEquipe';
import { NomPropose } from './NomPropose';
import { Photos } from './Photos';
import { Portrait } from './Portrait';
import { Quiz } from './Quiz';
import { BlindTest } from './BlindTest';
import { SurenchereMots } from './SurenchereMots';
import { Tournoi } from './Tournoi';
import { useEtatJoueur } from './useEtatJoueur';
import { useFilePhotos } from './useFilePhotos';

type Vue =
  'equipe' | 'attente' | 'photos' | 'ajout' | 'nom' | 'explication' | 'propose' | 'avis' | 'carte';

/** Le joueur a rejoint : « Mon équipe », puis l'attente, tenus à jour en continu. */
export function EcranJoueur({
  code,
  etatInitial,
  vueInitiale = 'attente',
  groupes = [],
}: {
  code: string;
  etatInitial: EtatJoueur;
  vueInitiale?: Vue;
  /** Les groupes de la soirée : un invité ajouté depuis ce téléphone peut en choisir un. */
  groupes?: GroupePublic[];
}) {
  const t = useTranslations();
  const { etat, horsLigne, decalageMs, remplacer, relire } = useEtatJoueur(code, etatInitial);
  const [vue, setVue] = useState<Vue>(vueInitiale);
  // « Comment jouer » lu à l'inscription mène à la partie ; rouvert, il y ramène (audit 18/11).
  const [arrivee, setArrivee] = useState(vueInitiale === 'explication');
  // La file vit ici, pas dans la vue Photos : elle se vide même quand le capitaine en sort.
  const file = useFilePhotos(code, remplacer);
  const router = useRouter();

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
  // Le message pour le grand écran, tant que la régie laisse les envois ouverts (2026-11-15).
  const outil = (
    <span className="tu-player__outils">
      {etat.evenement.messages_ouverts === true && <MessageEcran code={code} />}
      <ChoixLangueJoueur
        langues={etat.evenement.langues}
        choisir={(langue) => void changerLangue(langue)}
      />
    </span>
  );

  const bandeau = horsLigne ? (
    <p className="tu-banner" role="status">
      {t('horsLigne.bandeau')}
    </p>
  ) : null;

  if (vue === 'equipe' && etat.equipe) {
    const { numero, nom } = etat.equipe;
    // Le numéro reste visible même sous un nom choisi par le capitaine : la couleur ne suffit
    // pas à tout le monde (audit du 2026-11-18).
    const numeroVisible = !nom.includes(String(numero));
    const membres = trierMembres(etat.equipe.membres ?? []);
    return (
      <>
        {bandeau}
        <main className={cx('tu-team-screen', teamModifier(numero))}>
          <div className="tu-team-screen__main">
            <p className="tu-team-screen__eyebrow">{t('equipe.surtitre')}</p>
            <h1 className="tu-team-screen__name">{nom}</h1>
            {numeroVisible && (
              <p className="tu-team-screen__numero">{t('equipe.numero', { numero })}</p>
            )}
            <p className="tu-team-screen__hint">{t('equipe.aide', { numero })}</p>
            {membres.length > 0 && (
              <div className="tu-team-screen__membres" data-testid="coequipiers">
                <p className="tu-team-screen__eyebrow">{t('equipe.membres')}</p>
                <ul className="tu-team-screen__liste">
                  {membres.map((membre) => (
                    <li key={membre.prenom} className="tu-team-screen__membre">
                      {membre.prenom}
                      {membre.capitaine && (
                        <span className="tu-team-screen__role"> · {t('equipe.capitaine')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <Button size="lg" onClick={() => setVue('attente')}>
            {t('equipe.bouton')}
          </Button>
        </main>
      </>
    );
  }

  const {
    joueur,
    equipe,
    manche,
    prochaine,
    evenement,
    quiz,
    photos,
    surenchere,
    blind,
    portrait,
  } = etat;

  // Quiz en mode téléphone : le seul moment où le téléphone sert à jouer (spec v3).
  if (quiz) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <div className="tu-player__body">
          <Quiz
            code={code}
            quiz={quiz}
            decalageMs={decalageMs}
            remplacer={remplacer}
            relire={relire}
          />
        </div>
      </Cadre>
    );
  }

  // Surenchère en mode téléphones (2026-11-08) : le capitaine tape les mots de l'équipe.
  if (surenchere) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <div className="tu-player__body">
          <SurenchereMots
            code={code}
            surenchere={surenchere}
            decalageMs={decalageMs}
            remplacer={remplacer}
            relire={relire}
          />
        </div>
      </Cadre>
    );
  }

  // Blind test (2026-11-15) : le capitaine buzze, ses coéquipiers lui soufflent le titre.
  if (blind) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <div className="tu-player__body">
          <BlindTest
            code={code}
            blind={blind}
            capitaine={joueur.capitaine}
            remplacer={remplacer}
            relire={relire}
          />
        </div>
      </Cadre>
    );
  }

  // Portrait mystère (2026-11-18) : la grille à lire de près ; le capitaine y vote.
  if (portrait) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <div className="tu-player__body">
          <Portrait code={code} portrait={portrait} remplacer={remplacer} relire={relire} />
        </div>
      </Cadre>
    );
  }

  // Tournoi du gobelet (2026-11-21) : le poste et l'adversaire, en lecture seule.
  if (etat.tournoi) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <div className="tu-player__body">
          <Tournoi tournoi={etat.tournoi} />
        </div>
      </Cadre>
    );
  }

  // L'autorisation peut être retirée pendant la saisie : la vue se ferme d'elle-même.
  if (vue === 'ajout' && joueur.peut_ajouter && evenement.statut !== 'termine') {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <AjoutInvite code={code} groupes={groupes} retour={() => setVue('attente')} />
      </Cadre>
    );
  }

  // Le capitaine renomme son équipe ; s'il perd le rôle ou que la régie fige le nom pendant la
  // saisie, la vue se ferme d'elle-même.
  const peutRenommer =
    joueur.capitaine && !!equipe && !equipe.nom_fige && evenement.statut !== 'termine';
  if (vue === 'nom' && peutRenommer) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <NomEquipe
          code={code}
          nomActuel={equipe.nom}
          remplacer={remplacer}
          retour={() => setVue('attente')}
        />
      </Cadre>
    );
  }

  // L'avis de fin de soirée (2026-11-18), tant que la régie l'a ouvert, même partie terminée ;
  // fermé pendant la saisie, la vue se ferme d'elle-même.
  const avisOuverts = evenement.avis_ouverts === true;
  if (vue === 'avis' && avisOuverts) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <AvisJoueur
          code={code}
          avis={etat.avis ?? null}
          remplacer={remplacer}
          retour={() => setVue('attente')}
        />
      </Cadre>
    );
  }
  const boutonAvis = avisOuverts && (
    <Button variant="outline" size="lg" block onClick={() => setVue('avis')}>
      {etat.avis ? t('avis.revoir') : t('avis.ouvrir')}
    </Button>
  );

  // La carte « Faisons connaissance » (2026-11-18) : tant que la partie n'est pas terminée.
  const cartesActives = etat.carte !== undefined && evenement.statut !== 'termine';
  if (vue === 'carte' && cartesActives) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <CarteJoueur
          code={code}
          prenom={joueur.prenom}
          carte={etat.carte ?? null}
          remplacer={remplacer}
          retour={() => setVue('attente')}
        />
      </Cadre>
    );
  }

  if (vue === 'explication') {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <Explication
          programme={etat.programme ?? []}
          arrivee={arrivee}
          retour={() => {
            setArrivee(false);
            setVue('attente');
          }}
        />
      </Cadre>
    );
  }

  // Le volontaire change son nom proposé ; dès la formation des équipes, la vue se ferme.
  if (vue === 'propose' && joueur.volontaire && !equipe) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <NomPropose
          code={code}
          nomActuel={joueur.nom_propose ?? ''}
          remplacer={remplacer}
          retour={() => setVue('attente')}
        />
      </Cadre>
    );
  }

  if (vue === 'photos' && photos) {
    return (
      <Cadre bandeau={bandeau} outil={outil}>
        <div className="tu-player__body">
          <Photos
            photos={photos}
            capitaine={joueur.capitaine}
            sorts={file.sorts}
            apercus={file.apercus}
            ajouter={file.ajouter}
            retour={() => setVue('attente')}
          />
        </div>
      </Cadre>
    );
  }

  return (
    <Cadre bandeau={bandeau} outil={outil}>
      <div className="tu-player__body">
        <h1 className="tu-player__title">{t('attente.salut', { prenom: joueur.prenom })}</h1>

        {equipe ? (
          <button
            type="button"
            className={cx('tu-wait-team', teamModifier(equipe.numero))}
            onClick={() => setVue('equipe')}
            aria-label={`${t('attente.voirEquipe', { nom: equipe.nom })} : ${t('attente.points', { points: equipe.points })}`}
          >
            <span className="tu-wait-team__name">{equipe.nom}</span>
            <span className="tu-wait-team__points" data-testid="points">
              {t('attente.points', { points: equipe.points })}
            </span>
          </button>
        ) : (
          <>
            <p className="tu-player__lead" data-testid="sans-equipe">
              {t('equipe.sansEquipe')}
            </p>
            {joueur.volontaire && (
              <p className="tu-player__lead" data-testid="nom-propose">
                {joueur.nom_propose
                  ? t('proposition.actuel', { nom: joueur.nom_propose })
                  : t('proposition.aucun')}
              </p>
            )}
          </>
        )}

        {evenement.statut === 'termine' ? (
          <p className="tu-wait-game">{t('attente.termine')}</p>
        ) : manche ? (
          <p className="tu-wait-game">{t('attente.enCours', { jeu: t(`jeux.${manche.jeu}`) })}</p>
        ) : prochaine ? (
          <p className="tu-wait-game">
            {t('attente.prochain', { jeu: t(`jeux.${prochaine.jeu}`) })}
          </p>
        ) : null}

        {evenement.statut === 'termine' && boutonAvis && (
          <div className="tu-player__actions">{boutonAvis}</div>
        )}

        {evenement.statut !== 'termine' && (
          <div className="tu-player__actions">
            {manche ? (
              <p className="tu-wait-look">{t('attente.regarde')}</p>
            ) : (
              // Aucun jeu en cours : la phase d'attente, dite en clair (audit du 2026-11-18).
              <div className="tu-wait-state" data-testid="attente-lancement">
                <p className="tu-wait-look">{t('attente.lancement')}</p>
                <p className="tu-player__lead">{t('attente.rien')}</p>
              </div>
            )}
            {boutonAvis}
            {joueur.capitaine && equipe && (
              <p className="tu-player__lead" data-testid="capitaine">
                {t('attente.capitaine')}
              </p>
            )}
            {photos && equipe && (
              <Button
                variant={joueur.capitaine && !photos.closes ? 'accent' : 'outline'}
                size="lg"
                block
                onClick={() => setVue('photos')}
              >
                {t('photos.ouvrir', {
                  envoyees: photos.themes.filter((th) => th.envoyee_le !== null).length,
                  total: photos.themes.length,
                })}
              </Button>
            )}
            {peutRenommer && (
              <Button variant="outline" size="lg" block onClick={() => setVue('nom')}>
                {t('nomEquipe.ouvrir')}
              </Button>
            )}
            {joueur.peut_ajouter && (
              <Button variant="outline" size="lg" block onClick={() => setVue('ajout')}>
                {t('ajout.ouvrir')}
              </Button>
            )}
            {joueur.volontaire && !equipe && (
              <Button variant="outline" size="lg" block onClick={() => setVue('propose')}>
                {t('proposition.ouvrir')}
              </Button>
            )}
            {cartesActives && (
              <>
                {!etat.carte && (
                  <p className="tu-player__lead" data-testid="invitation-carte">
                    {t('maCarte.invitation')}
                  </p>
                )}
                <Button variant="outline" size="lg" block onClick={() => setVue('carte')}>
                  {etat.carte ? t('maCarte.revoir') : t('maCarte.ouvrir')}
                </Button>
              </>
            )}
            <Button variant="ghost" size="lg" block onClick={() => setVue('explication')}>
              {t('explication.revoir')}
            </Button>
            {evenement.messages_ouverts === true && (
              <Button variant="ghost" size="lg" block onClick={ouvrirMessageEcran}>
                {t('messageEcran.ouvrir')}
              </Button>
            )}
          </div>
        )}
      </div>
    </Cadre>
  );
}
