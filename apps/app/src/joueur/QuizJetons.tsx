'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, cx } from '@teamup/ui/react';
import { totalMise, type Repartition } from '@teamup/game';
import type { EtatJoueur, QuizJetons as Quiz, RefusMise } from '@/lib/partie';
import { ChronoQuestion, LETTRES, QuestionSeule } from './quizCommun';

/** Une mise en cours part au serveur ce délai après le dernier appui (l'écran la montre). */
const ENVOI_MS = 400;
/** Bouton tenu appuyé : un jeton de plus (ou de moins) à ce rythme, après ce délai. */
const REPETITION_ATTENTE_MS = 450;
const REPETITION_MS = 90;

interface Brouillon {
  passage: string | null;
  repartition: Repartition;
}

/**
 * Quiz en mode jetons (2026-10-18) : le capitaine répartit les jetons de l'équipe sur les quatre
 * réponses, − et +, puis « Valider » quand tout est posé. Chaque changement part au serveur
 * (l'écran le montre en direct) ; les coéquipiers voient la même mise, en lecture seule. Chrono
 * écoulé sans validation : l'équipe est figée jusqu'à ce que la régie la débloque.
 * Toutes les règles vivent dans la base ; cet écran ne fait qu'afficher ce qu'elle renvoie.
 */
export function QuizJetons({
  code,
  quiz,
  decalageMs,
  remplacer,
  relire,
}: {
  code: string;
  quiz: Quiz;
  decalageMs: number;
  remplacer: (etat: EtatJoueur) => void;
  relire: () => void;
}) {
  const t = useTranslations('quiz');
  // La mise que le capitaine compose : elle l'emporte sur la dernière lue, le temps qu'elle parte.
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [refus, setRefus] = useState<{ passage: string | null; refus: RefusMise } | null>(null);
  const brouillonRef = useRef<Brouillon | null>(null);
  const quizRef = useRef(quiz);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Les envois partent l'un après l'autre : une validation ne double jamais une mise partielle.
  const file = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    quizRef.current = quiz;
  }, [quiz]);
  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

  // On ne mise qu'une fois le chrono lancé, A, B, C, D à l'écran (2026-10-18).
  const ouverte = quiz.etape === 'question' && !!quiz.question && quiz.chrono_depart_ms !== null;
  const peutMiser = ouverte && quiz.capitaine && !quiz.valide && !quiz.fige && quiz.jetons > 0;
  const mise: Repartition =
    peutMiser && brouillon?.passage === quiz.passage_id ? brouillon.repartition : quiz.repartition;
  const reste = Math.max(0, quiz.jetons - totalMise(mise));
  const validationEnCours = validation === quiz.passage_id;
  const refusCourant = refus?.passage === quiz.passage_id ? refus.refus : null;

  const envoyer = async (passage: string | null, repartition: Repartition, valider: boolean) => {
    try {
      const reponse = await fetch(`/api/partie/${code}/mise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repartition, valider }),
      });
      const corps = (await reponse.json()) as EtatJoueur | { erreur: RefusMise };
      if ('erreur' in corps) {
        setRefus({ passage, refus: corps.erreur });
        // Mise refusée : on repart de celle que la base a gardée.
        if (corps.erreur === 'invalide') poser(null);
        relire();
      } else {
        setRefus(null);
        remplacer(corps);
      }
    } catch {
      // Réseau tombé : la mise reste à l'écran ; « Valider » la renverra, et la régie peut
      // débloquer l'équipe si le chrono tombe entre-temps.
      relire();
    }
  };

  const mettreEnFile = (repartition: Repartition, valider: boolean) => {
    const passage = quizRef.current.passage_id;
    file.current = file.current.then(() => envoyer(passage, repartition, valider));
    return file.current;
  };

  function poser(suivant: Brouillon | null) {
    brouillonRef.current = suivant;
    setBrouillon(suivant);
  }

  const ajuster = (i: number, delta: 1 | -1) => {
    const q = quizRef.current;
    const courant = brouillonRef.current;
    const base = courant?.passage === q.passage_id ? courant.repartition : q.repartition;
    const n = base[i]! + delta;
    if (n < 0 || (delta > 0 && totalMise(base) >= q.jetons)) return;
    const repartition = base.map((v, j) => (j === i ? n : v)) as unknown as Repartition;
    poser({ passage: q.passage_id, repartition });
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => {
      minuterie.current = null;
      void mettreEnFile(repartition, false);
    }, ENVOI_MS);
  };

  const valider = async () => {
    if (reste !== 0 || validationEnCours) return;
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = null;
    setValidation(quiz.passage_id);
    await mettreEnFile(mise, true);
    setValidation(null);
  };

  if (!quiz.equipe) {
    return <p className="tu-quiz__statut">{t('jetons.sansEquipe')}</p>;
  }

  if (quiz.etape === 'survivants' || quiz.etape === 'resultat') {
    return (
      <div className="tu-quiz__fin">
        <p className="tu-quiz__titre">{t('fin')}</p>
        <p
          className={cx(
            'tu-quiz__statut',
            quiz.jetons > 0 ? 'tu-quiz__statut--in' : 'tu-quiz__statut--out',
          )}
        >
          {t('jetons.restants', { n: quiz.jetons })}
        </p>
      </div>
    );
  }

  if (!quiz.question || (quiz.etape !== 'question' && quiz.etape !== 'reponse')) {
    return (
      <div className="tu-quiz__fin">
        <p className="tu-quiz__statut tu-quiz__statut--in">
          {t('jetons.equipe', { n: quiz.jetons })}
        </p>
        <p className="tu-player__lead">
          {quiz.jetons === 0
            ? t('jetons.plusDeJetons')
            : quiz.capitaine
              ? t('jetons.capitaine')
              : t('jetons.coequipier')}
        </p>
      </div>
    );
  }

  const revelee = quiz.etape === 'reponse' && quiz.bonne !== null;

  if (quiz.etape === 'question' && !ouverte) {
    return <QuestionSeule quiz={quiz} />;
  }

  const statut = revelee
    ? t('jetons.restants', { n: quiz.jetons })
    : quiz.jetons === 0
      ? t('jetons.plusDeJetons')
      : quiz.fige
        ? t('jetons.fige')
        : quiz.valide
          ? t('jetons.validee')
          : refusCourant === 'fermee'
            ? t('tropTard')
            : quiz.capitaine
              ? reste > 0
                ? t('jetons.reste', { n: reste })
                : t('jetons.toutPose')
              : t('jetons.coequipier');

  return (
    <div className="tu-quiz">
      <div className="tu-quiz__tete">
        <span className="tu-quiz__numero">
          {t('numero', { n: quiz.numero ?? 1, total: quiz.total })}
        </span>
        {quiz.etape === 'question' &&
          quiz.chrono_depart_ms !== null &&
          quiz.chrono_duree_s !== null && (
            <ChronoQuestion
              departMs={quiz.chrono_depart_ms}
              dureeS={quiz.chrono_duree_s}
              decalageMs={decalageMs}
            />
          )}
      </div>

      <h1 className="tu-quiz__question">{quiz.question.question}</h1>

      <ol className="tu-mises">
        {quiz.question.propositions.map((texte, i) => {
          const lettre = LETTRES[i]!;
          const n = mise[i] ?? 0;
          const etat = revelee
            ? i === quiz.bonne
              ? 'bonne'
              : n > 0
                ? 'fausse'
                : null
            : n > 0
              ? 'posee'
              : null;
          return (
            <li key={lettre} className={cx('tu-mise', etat && `tu-mise--${etat}`)}>
              <span className="tu-mise__texte">
                <span className="tu-mise__lettre" aria-hidden="true">
                  {lettre}
                </span>
                {texte}
              </span>
              {peutMiser ? (
                <span className="tu-mise__reglage">
                  <BoutonPas
                    libelle={t('jetons.moins', { lettre })}
                    actif={n > 0}
                    pas={() => ajuster(i, -1)}
                  >
                    −
                  </BoutonPas>
                  <output
                    className="tu-mise__nombre"
                    aria-label={t('jetons.ligne', { lettre, texte, n })}
                    data-testid={`mise-${lettre}`}
                  >
                    {n}
                  </output>
                  <BoutonPas
                    libelle={t('jetons.plus', { lettre })}
                    actif={reste > 0}
                    pas={() => ajuster(i, 1)}
                  >
                    +
                  </BoutonPas>
                </span>
              ) : (
                <span
                  className="tu-mise__nombre"
                  aria-label={t('jetons.ligne', { lettre, texte, n })}
                  data-testid={`mise-${lettre}`}
                >
                  {n}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p
        className={cx(
          'tu-quiz__statut',
          revelee && (quiz.jetons > 0 ? 'tu-quiz__statut--in' : 'tu-quiz__statut--out'),
          !revelee && quiz.fige && 'tu-quiz__statut--out',
        )}
        role="status"
        data-testid="statut-quiz"
      >
        {statut}
      </p>

      {peutMiser && (
        <Button
          variant="accent"
          size="lg"
          block
          disabled={reste !== 0 || validationEnCours}
          onClick={() => void valider()}
        >
          {t('jetons.valider')}
        </Button>
      )}
    </div>
  );
}

/**
 * Un bouton − ou + : un jeton par appui ; tenu appuyé, il continue (une équipe de 19 répartit
 * ses jetons sans 19 appuis). Le clic seul sert au clavier.
 */
function BoutonPas({
  libelle,
  actif,
  pas,
  children,
}: {
  libelle: string;
  actif: boolean;
  pas: () => void;
  children: string;
}) {
  const attente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repetition = useRef<ReturnType<typeof setInterval> | null>(null);
  // Un appui tenu a déjà compté ses jetons : le clic qui le termine ne doit pas en ajouter un.
  const repete = useRef(false);
  const pasRef = useRef(pas);

  useEffect(() => {
    pasRef.current = pas;
  }, [pas]);

  const arreter = () => {
    if (attente.current) clearTimeout(attente.current);
    if (repetition.current) clearInterval(repetition.current);
    attente.current = null;
    repetition.current = null;
  };

  useEffect(() => {
    if (!actif) arreter();
  }, [actif]);
  useEffect(() => arreter, []);

  return (
    <button
      type="button"
      className="tu-mise__pas"
      aria-label={libelle}
      disabled={!actif}
      onClick={() => {
        if (repete.current) {
          repete.current = false;
          return;
        }
        pasRef.current();
      }}
      onPointerDown={() => {
        arreter();
        repete.current = false;
        attente.current = setTimeout(() => {
          repetition.current = setInterval(() => {
            repete.current = true;
            pasRef.current();
          }, REPETITION_MS);
        }, REPETITION_ATTENTE_MS);
      }}
      onPointerUp={arreter}
      onPointerLeave={arreter}
      onPointerCancel={arreter}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
