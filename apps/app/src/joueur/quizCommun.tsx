'use client';

import { useTranslations } from 'next-intl';
import { cx } from '@teamup/ui/react';
import { formatChrono, tempsRestant } from '@teamup/game';
import type { QuizJoueur } from '@/lib/partie';
import { useMaintenant } from '@/ecran/Chrono';

export const LETTRES = ['A', 'B', 'C', 'D'] as const;

/** Le chrono d'une question du quiz, à l'heure de la base (décalage mesuré à chaque lecture). */
export function ChronoQuestion({
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

/** Avant le chrono : la question seule, les réponses arrivent une à une sur l'écran. */
export function QuestionSeule({ quiz }: { quiz: QuizJoueur }) {
  const t = useTranslations('quiz');
  return (
    <div className="tu-quiz">
      <div className="tu-quiz__tete">
        <span className="tu-quiz__numero">
          {t('numero', { n: quiz.numero ?? 1, total: quiz.total })}
        </span>
      </div>
      {quiz.question && <h1 className="tu-quiz__question">{quiz.question.question}</h1>}
      <p className="tu-quiz__statut" role="status" data-testid="statut-quiz">
        {t('reponsesAVenir')}
      </p>
    </div>
  );
}
