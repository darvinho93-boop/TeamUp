'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/**
 * Les avis des joueurs, au pilotage (2026-11-18) : ouvrir ou fermer le questionnaire d'un appui,
 * sans confirmation (comme les messages), et le compte des avis reçus. Ouvert, il reste sur les
 * téléphones même après la clôture de la soirée. L'écriture se fait sous la session de
 * l'animateur, puis le signal habituel : les téléphones relisent et le bouton paraît.
 */
export function PanneauAvis({
  code,
  evenementId,
  ouverts,
  recus,
  apresEcriture,
}: {
  code: string;
  evenementId: string;
  ouverts: boolean;
  recus: number;
  apresEcriture: () => Promise<void>;
}) {
  const t = useTranslations('regie.pilotage.avis');

  const basculer = async () => {
    await supabaseNavigateur().rpc('regler_avis', {
      p_evenement: evenementId,
      p_ouverts: !ouverts,
    });
    await apresEcriture();
  };

  return (
    <details className="tu-regie-avis" open data-testid="panneau-avis">
      <summary className="tu-regie__section-title">{t('titre')}</summary>
      <div className="tu-regie-avis__corps">
        <Button
          variant={ouverts ? 'primary' : 'ghost'}
          aria-pressed={ouverts}
          onClick={() => void basculer()}
          data-testid="avis-ouverts"
        >
          {ouverts ? t('ouverts') : t('fermes')}
        </Button>
        <span className="tu-regie__muted" data-testid="avis-recus">
          {t('recus', { n: recus })}
        </span>
        <Link href={`/regie/${code}/avis`} className="tu-regie__lien">
          {t('lire')}
        </Link>
      </div>
    </details>
  );
}
