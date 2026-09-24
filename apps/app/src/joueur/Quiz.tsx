'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cx } from '@teamup/ui/react';
import { formatChrono, tempsRestant } from '@teamup/game';
import type { EtatJoueur, QuizJoueur, RefusQuiz } from '@/lib/partie';
import { useMaintenant } from '@/ecran/Chrono';

export const LETTRES = ['A', 'B', 'C', 'D'] as const;

/**
 * Quiz en mode téléphone : la question en grand, quatre boutons. Une mauvaise réponse (ou pas
 * de réponse à temps) élimine : le téléphone le dit, puis le joueur regarde la suite.
 * Toutes les règles vivent dans la base ; cet écran ne fait qu'afficher ce qu'elle renvoie.
 */
export function Quiz({
  code,
  quiz,
  decalageMs,
  remplacer,
  relire,
}: {
  code: string;
  quiz: QuizJoueur;
  decalageMs: number;
  remplacer: (etat: EtatJoueur) => void;
  relire: () => void;
}) {
  const t = useTranslations('quiz');
  const [envoi, setEnvoi] = useState<{ passage: string | null; choix: number } | null>(null);
  const [refus, setRefus] = useState<{ passage: string | null; refus: RefusQuiz } | null>(null);

  const ouverte = quiz.etape === 'question';
  const envoiEnCours = envoi?.passage === quiz.passage_id ? envoi.choix : null;
  const refusCourant = refus?.passage === quiz.passage_id ? refus.refus : null;
  const peutRepondre =
    ouverte && quiz.participant && !quiz.elimine && quiz.ma_reponse === null && !refusCourant;

  const repondre = async (choix: number) => {
    if (!peutRepondre || envoiEnCours !== null) return;
    setEnvoi({ passage: quiz.passage_id, choix });
    try {
      const reponse = await fetch(`/api/partie/${code}/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choix }),
      });
      const corps = (await reponse.json()) as EtatJoueur | { erreur: RefusQuiz };
      if ('erreur' in corps) {
        setRefus({ passage: quiz.passage_id, refus: corps.erreur });
        relire();
      } else {
        remplacer(corps);
      }
    } catch {
      // Réseau tombé : en mode téléphone, le jeu s'arrête (spec v3). Le bandeau le dit déjà.
      relire();
    } finally {
      setEnvoi(null);
    }
  };

  if (!quiz.participant) {
    return <p className="tu-quiz__statut">{t('spectateur')}</p>;
  }

  if (quiz.etape === 'survivants' || quiz.etape === 'resultat') {
    return (
      <div className="tu-quiz__fin">
        <p className="tu-quiz__titre">{t('fin')}</p>
        <p
          className={cx(
            'tu-quiz__statut',
            quiz.elimine ? 'tu-quiz__statut--out' : 'tu-quiz__statut--in',
          )}
        >
          {quiz.elimine ? t('elimine') : t('survivant')}
        </p>
      </div>
    );
  }

  if (!quiz.question || (quiz.etape !== 'question' && quiz.etape !== 'reponse')) {
    return (
      <div className="tu-quiz__fin">
        <p
          className={cx(
            'tu-quiz__statut',
            quiz.elimine ? 'tu-quiz__statut--out' : 'tu-quiz__statut--in',
          )}
        >
          {quiz.elimine ? t('elimine') : t('enJeu')}
        </p>
        {!quiz.elimine && <p className="tu-player__lead">{t('prochaine')}</p>}
      </div>
    );
  }

  const choisie = quiz.ma_reponse ?? envoiEnCours;
  const revelee = quiz.etape === 'reponse' && quiz.bonne !== null;

  return (
    <div className="tu-quiz">
      <div className="tu-quiz__tete">
        <span className="tu-quiz__numero">
          {t('numero', { n: quiz.numero ?? 1, total: quiz.total })}
        </span>
        {ouverte && quiz.chrono_depart_ms !== null && quiz.chrono_duree_s !== null && (
          <ChronoQuestion
            departMs={quiz.chrono_depart_ms}
            dureeS={quiz.chrono_duree_s}
            decalageMs={decalageMs}
          />
        )}
      </div>

      <h1 className="tu-quiz__question">{quiz.question.question}</h1>

      <ol className="tu-quiz__choix">
        {quiz.question.propositions.map((texte, i) => {
          const etat = revelee
            ? i === quiz.bonne
              ? 'bonne'
              : i === choisie
                ? 'fausse'
                : null
            : i === choisie
              ? 'choisie'
              : null;
          return (
            <li key={LETTRES[i]}>
              <button
                type="button"
                className={cx('tu-quiz-choice', etat && `tu-quiz-choice--${etat}`)}
                onClick={() => void repondre(i)}
                disabled={!peutRepondre || envoiEnCours !== null}
                aria-pressed={i === choisie}
                aria-label={t('choix', { lettre: LETTRES[i]!, texte })}
              >
                <span className="tu-quiz-choice__lettre" aria-hidden="true">
                  {LETTRES[i]}
                </span>
                <span className="tu-quiz-choice__texte">{texte}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="tu-quiz__statut" role="status" data-testid="statut-quiz">
        {revelee
          ? quiz.elimine
            ? t('elimine')
            : t('bonne')
          : quiz.elimine
            ? t('elimine')
            : refusCourant === 'fermee'
              ? t('tropTard')
              : choisie !== null
                ? t('envoyee')
                : null}
      </p>
    </div>
  );
}

function ChronoQuestion({
  departMs,
  dureeS,
  decalageMs,
}: {
  departMs: number;
  dureeS: number;
  decalageMs: number;
}) {
  const maintenant = useMaintenant(true);
  const reste = tempsRestant(dureeS, Math.max(0, maintenant + decalageMs - departMs));
  return (
    <span className={cx('tu-quiz__chrono', reste === 0 && 'tu-quiz__chrono--zero')} role="timer">
      {formatChrono(reste)}
    </span>
  );
}
