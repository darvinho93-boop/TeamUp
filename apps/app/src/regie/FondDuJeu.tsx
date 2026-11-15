'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { BoutonConfirme } from './BoutonConfirme';
import { FondRefuse, preparerFond, type FondPret, type RefusFond } from './preparerFond';

/**
 * La photo de fond d'un jeu (2026-11-15), sur sa carte de la préparation : choisie, recadrée et
 * réduite par le navigateur, montrée dans la vignette sous le voile de l'écran commun, puis
 * envoyée par « Enregistrer ». Possible à tout moment, même en pleine soirée : l'écran suit sans
 * recharger.
 */
export function FondDuJeu({
  code,
  manche,
  ordre,
  actuel,
}: {
  code: string;
  manche: string;
  ordre: number;
  /** L'aperçu de la photo en place (URL signée), ou `null`. */
  actuel: string | null;
}) {
  const t = useTranslations('regie.preparation.fond');
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [pret, setPret] = useState<(FondPret & { url: string }) | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<RefusFond | 'envoi' | null>(null);

  // L'aperçu local (blob:) est libéré dès qu'il est remplacé, ou que la page se ferme.
  useEffect(() => {
    if (!pret) return;
    return () => URL.revokeObjectURL(pret.url);
  }, [pret]);

  async function choisir(fichier: File | undefined) {
    setErreur(null);
    if (!fichier) return;
    setEnCours(true);
    try {
      const fond = await preparerFond(fichier);
      setPret({ ...fond, url: URL.createObjectURL(fond.blob) });
    } catch (e) {
      setPret(null);
      setErreur(e instanceof FondRefuse ? e.refus : 'illisible');
    } finally {
      setEnCours(false);
      if (champ.current) champ.current.value = '';
    }
  }

  /** Dépôt ou retrait : la route répond `{ chemin }`, tout le reste est un échec. */
  async function envoyer(methode: 'POST' | 'DELETE', corps?: FormData) {
    setEnCours(true);
    setErreur(null);
    const reponse = await fetch(`/regie/${code}/fond/${manche}`, {
      method: methode,
      ...(corps ? { body: corps } : {}),
    }).catch(() => null);
    const suite: unknown = reponse?.ok ? await reponse.json().catch(() => null) : null;
    setEnCours(false);
    if (typeof suite !== 'object' || suite === null || !('chemin' in suite)) {
      return setErreur('envoi');
    }
    setPret(null);
    router.refresh();
  }

  function enregistrer() {
    if (!pret) return;
    const corps = new FormData();
    corps.set('fichier', pret.blob, 'fond.jpg');
    void envoyer('POST', corps);
  }

  const montre = pret?.url ?? actuel;

  return (
    <div className="tu-regie__section" data-testid={`fond-${ordre}`}>
      <div className="tu-regie-fond">
        <figure className="tu-regie-fond__vignette" aria-label={t('apercu')}>
          {montre && (
            <>
              {/* Aperçu local (blob:) ou URL signée du bucket privé : rien à optimiser. */}
              <img src={montre} alt="" data-testid="fond-apercu" />
              <span className="tu-regie-fond__voile" />
            </>
          )}
        </figure>
        <div className="tu-stack">
          <span className="tu-regie-item__title">{t('titre')}</span>
          <p className="tu-regie__muted" role="status" data-testid="fond-statut">
            {enCours ? t('envoi') : pret ? t('aEnregistrer') : actuel ? t('enPlace') : t('aucune')}
          </p>
          <input
            ref={champ}
            className="tu-visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            tabIndex={-1}
            aria-label={t('choisir')}
            disabled={enCours}
            onChange={(e) => void choisir(e.target.files?.[0])}
            data-testid="fond-fichier"
          />
          <div className="tu-cluster">
            <Button
              type="button"
              variant="ghost"
              disabled={enCours}
              onClick={() => champ.current?.click()}
            >
              {actuel || pret ? t('changer') : t('choisir')}
            </Button>
            {pret && (
              <Button type="button" disabled={enCours} onClick={enregistrer}>
                {t('enregistrer')}
              </Button>
            )}
            {actuel && !pret && (
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
      </div>
      {!montre && <p className="tu-regie__muted">{t('aide')}</p>}
      {pret?.recadre && (
        <p className="tu-regie__alert" role="status" data-testid="fond-recadre">
          {t('recadre')}
        </p>
      )}
      {pret?.petit && (
        <p className="tu-regie__alert" role="status" data-testid="fond-petit">
          {t('petit')}
        </p>
      )}
      {erreur && (
        <p className="tu-regie__alert" role="alert" data-testid="fond-erreur">
          {t(`erreur.${erreur}`)}
        </p>
      )}
    </div>
  );
}
