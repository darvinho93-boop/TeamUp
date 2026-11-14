'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Wordmark } from '@teamup/ui/react';
import { Pictogramme } from '@/marque/Pictogramme';
import { BoutonConfirme } from './BoutonConfirme';
import { LogoRefuse, preparerLogo, type LogoPret, type RefusLogo } from './preparerLogo';

/**
 * Le logo du partenaire de la soirée (2026-11-11) : choisi ici, rogné et mis à la taille par le
 * navigateur, puis montré en face de la marque Team Up! comme il le sera en haut de l'écran
 * commun (mêmes classes, donc même boîte). Rien n'est enregistré avant « Enregistrer ».
 */
export function LogoPartenaire({ code, actuel }: { code: string; actuel: string | null }) {
  const t = useTranslations('regie.preparation.partenaire');
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [pret, setPret] = useState<(LogoPret & { url: string }) | null>(null);
  const [erreur, setErreur] = useState<RefusLogo | 'envoi' | null>(null);
  const [enCours, setEnCours] = useState(false);

  // L'aperçu local (blob:) est libéré dès qu'il est remplacé, ou que la page se ferme.
  useEffect(() => {
    if (!pret) return;
    return () => URL.revokeObjectURL(pret.url);
  }, [pret]);

  async function choisir(fichier: File | undefined) {
    setErreur(null);
    if (!fichier) return setPret(null);
    try {
      const logo = await preparerLogo(fichier);
      setPret({ ...logo, url: URL.createObjectURL(logo.blob) });
    } catch (e) {
      setPret(null);
      setErreur(e instanceof LogoRefuse ? e.refus : 'illisible');
    }
  }

  /** Dépôt ou retrait : la route répond `{ chemin }`, tout le reste est un échec. */
  async function envoyer(methode: 'POST' | 'DELETE', corps?: FormData) {
    setEnCours(true);
    setErreur(null);
    const reponse = await fetch(`/regie/${code}/logo`, {
      method: methode,
      ...(corps ? { body: corps } : {}),
    }).catch(() => null);
    const suite: unknown = reponse?.ok ? await reponse.json().catch(() => null) : null;
    setEnCours(false);
    if (typeof suite !== 'object' || suite === null || !('chemin' in suite)) {
      return setErreur('envoi');
    }
    setPret(null);
    if (champ.current) champ.current.value = '';
    router.refresh();
  }

  function enregistrer() {
    if (!pret) return;
    const corps = new FormData();
    corps.set('fichier', pret.blob, 'logo.png');
    void envoyer('POST', corps);
  }

  const montre = pret?.url ?? actuel;

  return (
    <div className="tu-regie__section" data-testid="logo-partenaire">
      <label className="tu-field">
        <span className="tu-field__label">{t('choisir')}</span>
        <input
          ref={champ}
          className="tu-field__control"
          type="file"
          accept="image/png,image/webp,image/svg+xml"
          disabled={enCours}
          onChange={(e) => void choisir(e.target.files?.[0])}
        />
      </label>

      <figure className="tu-regie-marques" aria-label={t('apercu')}>
        <span className="tu-regie-marques__partenaire">
          {montre && (
            // Aperçu local (blob:) ou fichier du bucket public : rien à optimiser côté Next.
            <img className="tu-logo-partenaire" src={montre} alt="" data-testid="logo-apercu" />
          )}
        </span>
        <span className="tu-marque">
          <Pictogramme taille="coin" />
          <Wordmark className="tu-stage__nom" />
        </span>
      </figure>

      <p className="tu-regie__muted" role="status" data-testid="logo-statut">
        {pret ? t('aEnregistrer') : actuel ? t('enPlace') : t('aucun')}
      </p>
      {pret?.fond && (
        <p className="tu-regie__alert" role="status" data-testid="logo-fond">
          {t('fond')}
        </p>
      )}
      {pret?.petit && (
        <p className="tu-regie__alert" role="status" data-testid="logo-petit">
          {t('petit')}
        </p>
      )}
      {erreur && (
        <p className="tu-regie__alert" role="alert" data-testid="logo-erreur">
          {t(`erreur.${erreur}`)}
        </p>
      )}

      <div className="tu-cluster">
        <Button type="button" disabled={!pret || enCours} onClick={enregistrer}>
          {t('enregistrer')}
        </Button>
        {actuel && (
          <BoutonConfirme
            type="button"
            variant="ghost"
            disabled={enCours}
            confirmation={t('confirmerRetrait')}
            onConfirm={() => void envoyer('DELETE')}
          >
            {t('retirer')}
          </BoutonConfirme>
        )}
      </div>
    </div>
  );
}
