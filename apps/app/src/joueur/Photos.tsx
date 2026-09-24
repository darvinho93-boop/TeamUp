'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Button, cx } from '@teamup/ui/react';
import type { PhotosJoueur } from '@/lib/partie';
import type { SortPhoto } from './useFilePhotos';

/**
 * Le photo challenge, ouvert toute la soirée (spec v3) : les thèmes, où en est mon équipe, et
 * pour le capitaine seulement, le bouton pour prendre ou remplacer la photo d'un thème.
 */
export function Photos({
  photos,
  capitaine,
  sorts,
  apercus,
  ajouter,
  retour,
}: {
  photos: PhotosJoueur;
  capitaine: boolean;
  sorts: Record<string, SortPhoto>;
  apercus: Record<string, string>;
  ajouter: (themeId: string, fichier: File) => Promise<void>;
  retour: () => void;
}) {
  const t = useTranslations('photos');
  const format = useFormatter();
  const envoyees = photos.themes.filter((th) => th.envoyee_le !== null).length;

  const statut = (theme: PhotosJoueur['themes'][number]): { texte: string; ton?: string } => {
    const sort = sorts[theme.theme_id];
    if (sort?.etat === 'envoi') return { texte: t('envoi') };
    if (sort?.etat === 'attente') return { texte: t('attente'), ton: 'attente' };
    if (sort?.etat === 'refusee') return { texte: t(`refus.${sort.refus}`), ton: 'refus' };
    if (theme.envoyee_le !== null) {
      return {
        texte: t('envoyee', {
          heure: format.dateTime(new Date(theme.envoyee_le), {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }),
        ton: 'ok',
      };
    }
    return { texte: t('aFaire') };
  };

  return (
    <div className="tu-photos">
      <h1 className="tu-player__title">{t('titre')}</h1>
      <p className="tu-player__lead">
        {photos.closes ? t('closes') : capitaine ? t('capitaine') : t('equipier')}
      </p>
      <p className="tu-photos__compte">{t('compte', { envoyees, total: photos.themes.length })}</p>

      <ol className="tu-photos__liste">
        {photos.themes.map((theme, i) => {
          const { texte, ton } = statut(theme);
          const deja = theme.envoyee_le !== null || sorts[theme.theme_id] !== undefined;
          return (
            <li key={theme.theme_id} className="tu-photo-theme">
              <div className="tu-photo-theme__tete">
                {apercus[theme.theme_id] && (
                  // Aperçu local (blob:) de la dernière photo prise sur ce téléphone.
                  <img className="tu-photo-theme__apercu" src={apercus[theme.theme_id]} alt="" />
                )}
                <div>
                  <p className="tu-photo-theme__numero">{t('numero', { n: i + 1 })}</p>
                  <h2 className="tu-photo-theme__nom">{theme.theme ?? '—'}</h2>
                  <p
                    className={cx(
                      'tu-photo-theme__statut',
                      ton && `tu-photo-theme__statut--${ton}`,
                    )}
                    data-testid={`statut-photo-${i + 1}`}
                    role="status"
                  >
                    {texte}
                  </p>
                </div>
              </div>
              {capitaine && !photos.closes && (
                <label className="tu-btn tu-btn--accent tu-btn--lg tu-btn--block tu-photo-theme__prendre">
                  {deja ? t('remplacer') : t('prendre')}
                  <span className="tu-visually-hidden"> — {theme.theme}</span>
                  <input
                    className="tu-visually-hidden"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const fichier = e.currentTarget.files?.[0];
                      e.currentTarget.value = '';
                      if (fichier) void ajouter(theme.theme_id, fichier);
                    }}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ol>

      <div className="tu-player__actions">
        <Button variant="ghost" size="lg" block onClick={retour}>
          {t('retour')}
        </Button>
      </div>
    </div>
  );
}
