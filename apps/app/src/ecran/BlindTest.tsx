'use client';

import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import { resultatBlindDe, type EtapeBlind } from '@teamup/game';
import { extraitBlind, titresBlind } from '@/lib/pilotage';
import { passageCourant, type EtatSalle, type MancheSalle } from '@/lib/salle';
import { Celebration, useArrivee } from './Celebration';
import { Chrono } from './Chrono';
import { useMusiquesDuJeu } from './useMusiquesDuJeu';

/**
 * Le blind test à l'écran commun (2026-11-15). Écoute : un égaliseur, le temps d'extrait qui
 * reste, les équipes qui n'ont plus la main estompées. Buzz : l'équipe en grand, à sa couleur,
 * avec ses 7 s. Révélé : titre et artiste, l'équipe qui a trouvé, la fête. La musique, elle, part
 * du lecteur de l'écran (`useSons`), jamais de cette scène.
 */
export function BlindTest({
  etat,
  decalageMs,
  manche,
}: {
  etat: EtatSalle;
  decalageMs: number;
  manche: MancheSalle;
}) {
  const t = useTranslations('ecran.blind');
  const passage = passageCourant(etat);
  const etape = etat.pilotage.etape as EtapeBlind | null;
  const resultat = resultatBlindDe(passage?.resultat);
  const fete = useArrivee(etape === 'revele' && resultat.trouvePar !== null);
  const titres = titresBlind(manche);
  // La réponse ne s'affiche qu'à `revele` ; l'écran lit la bibliothèque sous la session de
  // l'animateur, comme la régie.
  const musiques = useMusiquesDuJeu(titres.flatMap((x) => (x.musique ? [x.musique] : [])));
  if (!passage || !etape) return null;

  const equipe = (numero: number | null) => etat.equipes.find((e) => e.numero === numero);
  const titre = titres[passage.ordre - 1];
  const musique = titre?.musique ? musiques.get(titre.musique) : undefined;
  const enJeu = etat.equipes.filter((e) => e.joueurs > 0);
  const numero = (
    <p className="tu-stage__m tu-stage-blind__numero">
      {t('titre', { n: passage.ordre, total: manche.passages.length })}
    </p>
  );

  if (etape === 'buzz' || etape === 'pause') {
    // `pause` : l'équipe qui vient de se tromper, avant que la régie relance la musique.
    const qui = equipe(etape === 'buzz' ? resultat.buzz : (resultat.bloquees.at(-1) ?? null));
    return (
      <div
        className={cx(
          // Plein écran, comme un verdict : la marque du coin passe en clair dessus.
          'tu-stage__body tu-stage-centre tu-stage-reveal tu-stage-verdict tu-stage-blind__main',
          qui && teamModifier(qui.numero),
          etape === 'buzz' ? 'tu-stage-blind__main--buzz' : 'tu-stage-blind__main--rate',
        )}
        data-scene="blind"
        data-etape={etape}
      >
        {numero}
        <p className="tu-stage__giant tu-stage-blind__equipe" data-testid="blind-equipe">
          {qui
            ? etape === 'buzz'
              ? t('buzz', { equipe: qui.nom })
              : t('rate', { equipe: qui.nom })
            : ''}
        </p>
        {etape === 'buzz' ? (
          <>
            <Chrono
              departMs={etat.pilotage.chrono_depart_ms}
              dureeS={etat.pilotage.chrono_duree_s ?? 7}
              decalageMs={decalageMs}
              className="tu-stage__giant"
            />
            <p className="tu-stage__xl">{t('reponse')}</p>
          </>
        ) : (
          <p className="tu-stage__xl">{t('attente')}</p>
        )}
      </div>
    );
  }

  if (etape === 'revele') {
    const gagnante = equipe(resultat.trouvePar);
    return (
      <div
        className={cx(
          'tu-stage__body tu-stage-centre tu-stage-reveal',
          gagnante && 'tu-stage-verdict tu-stage-verdict--vert',
        )}
        data-scene="blind"
        data-etape={etape}
      >
        {numero}
        <p className="tu-stage__l">{t('revele')}</p>
        <p className="tu-stage__giant tu-stage-blind__reponse" data-testid="blind-reponse">
          {musique?.titre ?? '—'}
        </p>
        {musique?.artiste && <p className="tu-stage__xl">{musique.artiste}</p>}
        <p className="tu-stage__xl" data-testid="blind-verdict">
          {gagnante ? t('trouvePar', { equipe: gagnante.nom }) : t('personne')}
        </p>
        {fete && <Celebration force={2} />}
      </div>
    );
  }

  return (
    <div className="tu-stage__body tu-stage-centre" data-scene="blind" data-etape={etape}>
      {numero}
      <div
        className={cx(
          'tu-stage-blind__egaliseur',
          etape === 'ecoute' && 'tu-stage-blind__egaliseur--joue',
        )}
        aria-hidden="true"
      >
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="tu-stage-blind__barre" />
        ))}
      </div>
      {etape === 'ecoute' ? (
        <>
          <Chrono
            departMs={etat.pilotage.chrono_depart_ms}
            dureeS={etat.pilotage.chrono_duree_s ?? extraitBlind(manche)}
            decalageMs={decalageMs}
            className="tu-stage__giant"
          />
          <p className="tu-stage__xl">{t('ecoute')}</p>
        </>
      ) : (
        <p className="tu-stage__xl">{t('pret')}</p>
      )}
      {resultat.bloquees.length > 0 && (
        <div className="tu-stage-blind__equipes" data-testid="blind-bloquees">
          {enJeu.map((e) => (
            <span
              key={e.id}
              className={cx(
                'tu-team tu-team--badge',
                teamModifier(e.numero),
                resultat.bloquees.includes(e.numero) && 'tu-stage-blind__bloquee',
              )}
            >
              {e.nom}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
