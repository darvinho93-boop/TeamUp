'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { themeDe } from '@/lib/faire-part';
import type { Commande } from '@/lib/pilotage';
import type { EtatSalle } from '@/lib/salle';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import { BoutonConfirme } from './BoutonConfirme';

/**
 * Le bonus d'une soirée à thème (2026-11-28) : la chanson choisie par les hôtes, lancée en karaoké
 * quand l'animateur juge l'ambiance bonne (deux appuis), puis coupée en fondu. Absent d'une soirée
 * sans thème ou dont le thème n'a pas de bonus.
 */
export function BonusSoiree({ etat, agir }: { etat: EtatSalle; agir: (c: Commande) => void }) {
  const t = useTranslations('regie.pilotage.bonus');
  const tPilotage = useTranslations('regie.pilotage');
  const [titre, setTitre] = useState<string | null>(null);
  const evenementId = etat.evenement.id;

  useEffect(() => {
    let actif = true;
    void (async () => {
      const supabase = supabaseNavigateur();
      const { data } = await supabase
        .from('themes_soiree')
        .select('theme, fichiers, reglages')
        .eq('evenement_id', evenementId)
        .maybeSingle();
      const musique = themeDe(data)?.reglages.bonus?.musique;
      if (!musique) return;
      const { data: ligne } = await supabase
        .from('musiques')
        .select('titre')
        .eq('id', musique)
        .maybeSingle();
      if (actif && ligne) setTitre(ligne.titre);
    })();
    return () => {
      actif = false;
    };
  }, [evenementId]);

  if (!titre) return null;
  const enCours = etat.pilotage.scene === 'bonus' && etat.pilotage.etape === 'karaoke';
  return (
    <div className="tu-cluster" data-testid="bonus">
      {enCours ? (
        <Button
          variant="primary"
          onClick={() => agir({ type: 'bonus', etape: 'couper' })}
          data-testid="bonus-couper"
        >
          {t('couper')}
        </Button>
      ) : (
        <BoutonConfirme
          variant="ghost"
          confirmation={tPilotage('confirmer', { action: t('lancerAction') })}
          onConfirm={() => agir({ type: 'bonus', etape: 'karaoke' })}
          data-testid="bonus-lancer"
        >
          {t('lancer', { titre })}
        </BoutonConfirme>
      )}
    </div>
  );
}
