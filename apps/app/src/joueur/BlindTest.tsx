'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cx, teamModifier } from '@teamup/ui/react';
import type { BlindJoueur, EtatJoueur, RefusBuzz } from '@/lib/partie';
import { useVibration, VIBRATION_JUSTE } from './useApresSuspense';

/**
 * Blind test au téléphone (2026-11-15) : pendant l'écoute, le capitaine d'une équipe qui a encore
 * la main a un gros bouton BUZZ ; ses coéquipiers lui soufflent le titre. La base dit qui a buzzé
 * le premier ; cet écran affiche ce qu'elle renvoie, et ne reçoit jamais la musique ni la réponse.
 */
export function BlindTest({
  code,
  blind: b,
  capitaine,
  remplacer,
  relire,
}: {
  code: string;
  blind: BlindJoueur;
  capitaine: boolean;
  remplacer: (etat: EtatJoueur) => void;
  relire: () => void;
}) {
  const t = useTranslations('blind');
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<{
    titre: number | null;
    cle: Exclude<RefusBuzz, 'session'>;
  } | null>(null);

  async function buzzer() {
    if (envoi) return;
    setEnvoi(true);
    setRefus(null);
    const reponse = await fetch(`/api/partie/${code}/buzz`, { method: 'POST' }).catch(() => null);
    setEnvoi(false);
    if (reponse?.ok) {
      // Un retour sous les doigts : le buzz est passé.
      if (typeof navigator.vibrate === 'function') navigator.vibrate(200);
      remplacer((await reponse.json()) as EtatJoueur);
      return;
    }
    const corps = (await reponse?.json().catch(() => null)) as { erreur?: RefusBuzz } | null;
    const cle = corps?.erreur;
    if (cle && cle !== 'session') setRefus({ titre: b.titre, cle });
    relire();
  }

  // Le karaoké (2026-11-23) se regarde sur le grand écran : ici, c'est déjà le titre révélé.
  const revele = b.etape === 'revele' || b.etape === 'karaoke';
  // Le titre trouvé par son équipe : bandeau vert et vibration (2026-11-19).
  const trouve = revele && b.equipe !== null && b.trouve_par === b.equipe;
  useVibration(trouve, VIBRATION_JUSTE);

  if (b.equipe === null) return <p className="tu-quiz__statut">{t('sansEquipe')}</p>;

  const aLaMain = b.etape === 'buzz' && b.buzz === b.equipe;
  const statut = revele
    ? b.trouve_par === b.equipe
      ? t('trouve')
      : t('revele')
    : aLaMain
      ? t('aVous')
      : b.etape === 'buzz'
        ? t('autre')
        : b.bloquee
          ? t('bloquee')
          : refus?.titre === b.titre && refus.cle === 'tard'
            ? t('tropTard')
            : b.etape === 'pret'
              ? t('pret')
              : capitaine
                ? t('aide')
                : t('coequipier');

  return (
    <div className="tu-quiz" data-testid="blind-joueur" data-etape={b.etape ?? ''}>
      {b.titre !== null && (
        <div className="tu-quiz__tete">
          <span className="tu-quiz__numero">{t('titre', { n: b.titre, total: b.titres })}</span>
        </div>
      )}
      {capitaine && (b.etape === 'ecoute' || b.etape === 'pause') && !b.bloquee && (
        <button
          type="button"
          className={cx('tu-buzzer', b.peut_buzzer && 'tu-buzzer--pret')}
          disabled={!b.peut_buzzer || envoi}
          onClick={() => void buzzer()}
          data-testid="buzzer"
        >
          {t('buzz')}
        </button>
      )}
      <p
        className={cx(
          'tu-quiz__statut',
          aLaMain && 'tu-quiz__statut--fort',
          // L'équipe qui a la main, à sa couleur ; le titre trouvé, en vert (2026-11-19).
          aLaMain && cx('tu-quiz__statut--equipe', teamModifier(b.equipe)),
          trouve && 'tu-quiz__statut--verdict tu-quiz__statut--in',
        )}
        role="status"
        data-testid="statut-blind"
      >
        {statut}
      </p>
    </div>
  );
}
