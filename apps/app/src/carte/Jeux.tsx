'use client';

import { useTranslations } from 'next-intl';
import { SOCLE_GAMES } from '@teamup/game';
import { ListeJeux } from './ListeJeux';

/**
 * L'onglet « Les jeux » de la carte Team Up! (`/soirees/jeux`) : les cinq jeux, la règle de
 * chacun en une phrase (celle de l'écran commun) et sa vidéo explicative (`ListeJeux`).
 * « Je m'inscris » n'est que sur l'onglet de l'événement du jour.
 */
export function Jeux() {
  const t = useTranslations('carte');

  return (
    <div className="tu-player__body tu-carte" data-testid="jeux">
      <section className="tu-carte-section" aria-labelledby="titre-jeux">
        <h1 className="tu-carte-section__titre tu-carte-section__titre--page" id="titre-jeux">
          {t('jeuxTitre')}
        </h1>
        <ListeJeux jeux={SOCLE_GAMES} />
      </section>
    </div>
  );
}
