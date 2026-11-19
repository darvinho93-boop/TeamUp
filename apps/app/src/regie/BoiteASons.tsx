'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { BRUITAGES, type Bruitage } from '@/lib/sons';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/**
 * Boîte à sons et habillage du plateau (2026-11-19, audit « jeu télé »), au pilotage, sous le
 * réglage du son. Une touche, un son à l'écran commun, quand l'animateur veut relancer
 * l'ambiance : le son demandé s'écrit en base (`jouer_bruitage`), puis le signal que seuls
 * l'écran et la régie écoutent. L'habillage (halo, ronds en fond) se retire pour une soirée.
 */
export function BoiteASons({
  evenementId,
  habillage,
  sonActif,
  apresBruitage,
  apresHabillage,
}: {
  evenementId: string;
  habillage: boolean;
  sonActif: boolean;
  apresBruitage: () => void;
  apresHabillage: () => Promise<void>;
}) {
  const t = useTranslations('regie.pilotage.bruitages');
  const [enCours, setEnCours] = useState<Bruitage | null>(null);
  const [erreur, setErreur] = useState(false);

  const jouer = async (son: Bruitage) => {
    setEnCours(son);
    setErreur(false);
    const { error } = await supabaseNavigateur().rpc('jouer_bruitage', {
      p_evenement: evenementId,
      p_son: son,
    });
    setEnCours(null);
    if (error) setErreur(true);
    else apresBruitage();
  };

  const basculer = async () => {
    const { error } = await supabaseNavigateur().rpc('regler_habillage', {
      p_evenement: evenementId,
      p_actif: !habillage,
    });
    if (error) setErreur(true);
    else await apresHabillage();
  };

  return (
    <section className="tu-regie__section" aria-label={t('titre')} data-testid="boite-a-sons">
      <h2 className="tu-regie__section-title">{t('titre')}</h2>
      {!sonActif && <p className="tu-regie__muted">{t('sonCoupe')}</p>}
      <div className="tu-cluster">
        {BRUITAGES.map((son) => (
          <Button
            key={son}
            variant="outline"
            disabled={enCours !== null}
            onClick={() => void jouer(son)}
            data-testid={`bruitage-${son}`}
          >
            {t(son)}
          </Button>
        ))}
      </div>
      <div className="tu-cluster">
        <Button
          variant={habillage ? 'primary' : 'ghost'}
          aria-pressed={habillage}
          onClick={() => void basculer()}
          data-testid="habillage"
        >
          {habillage ? t('habillageActif') : t('habillageRetire')}
        </Button>
      </div>
      {erreur && (
        <p className="tu-player__error" role="alert">
          {t('erreur')}
        </p>
      )}
    </section>
  );
}
