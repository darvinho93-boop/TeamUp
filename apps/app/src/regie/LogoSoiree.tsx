'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { enregistrerLogo, retirerLogo, type EtatLogo } from '@/app/regie/[code]/salle/actions';
import { ecrireMonogramme, lireMonogramme, TITRE_MAX, type LogoSoiree } from '@/lib/logo-soiree';
import { useSignalSalle } from './SignalSalle';

/**
 * Le logo de la soirée : un monogramme (« V | M ») et le titre qu'il devient à l'écran
 * (« Vinoyan & Mélanie »), avec un aperçu dans l'habillage du faire-part. Il paraît quand la
 * régie passe de l'ouverture à l'accueil, puis en bandeau au-dessus du QR code.
 */
export function LogoSoiree({ code, logo }: { code: string; logo: LogoSoiree | null }) {
  const t = useTranslations('regie.salle');
  const signaler = useSignalSalle();
  const [monogramme, setMonogramme] = useState(logo ? ecrireMonogramme(logo.initiales) : '');
  const [titre, setTitre] = useState(logo?.titre ?? '');
  const [etat, action, envoi] = useActionState(async (precedent: EtatLogo, donnees: FormData) => {
    const resultat = await enregistrerLogo(code, precedent, donnees);
    if (resultat?.ok) signaler();
    return resultat;
  }, undefined);
  const initiales = lireMonogramme(monogramme);

  return (
    <form action={action} className="tu-regie__section" data-testid="logo-soiree">
      <h2 className="tu-regie__section-title">{t('logoTitre')}</h2>
      <p className="tu-regie__muted">{t('logoAide')}</p>
      <div className="tu-regie__form">
        <TextField
          label={t('monogramme')}
          hint={t('monogrammeAide')}
          name="monogramme"
          value={monogramme}
          onChange={(e) => setMonogramme(e.target.value)}
          maxLength={15}
          autoComplete="off"
          required
        />
        <TextField
          label={t('titreLogo')}
          hint={t('titreLogoAide')}
          name="titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          maxLength={TITRE_MAX}
          autoComplete="off"
          required
        />
      </div>
      {initiales && titre.trim() && (
        <div className="tu-regie-logo" aria-label={t('apercuLogo')} role="img">
          <p className="tu-soiree__monogramme">{initiales.join(' | ')}</p>
          <p className="tu-soiree__titre">{titre.trim()}</p>
        </div>
      )}
      {etat?.erreur && (
        <p className="tu-regie__alert" role="alert">
          {etat.erreur}
        </p>
      )}
      {etat?.ok && (
        <p className="tu-regie__muted" role="status">
          {etat.ok}
        </p>
      )}
      <div className="tu-cluster">
        <Button type="submit" disabled={envoi}>
          {t('enregistrerLogo')}
        </Button>
        {logo && (
          <Button
            variant="ghost"
            disabled={envoi}
            onClick={() =>
              void retirerLogo(code).then(() => {
                setMonogramme('');
                setTitre('');
                signaler();
              })
            }
          >
            {t('retirerLogo')}
          </Button>
        )}
      </div>
    </form>
  );
}
