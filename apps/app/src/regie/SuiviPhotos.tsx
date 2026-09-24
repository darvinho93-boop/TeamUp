'use client';

import { useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button, TeamDot } from '@teamup/ui/react';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import { texteParLangue, type EtatSalle } from '@/lib/salle';
import { useEtatSalle } from '@/ecran/useEtatSalle';
import { usePhotosSignees } from '@/ecran/usePhotosSignees';
import { BoutonConfirme } from './BoutonConfirme';

/**
 * Suivi des envois photo, toute la soirée : qui a envoyé quoi, et la clôture. La clôture se pose
 * ici quand l'animateur le décide, ou d'elle-même au lancement de la diffusion (décision du
 * 2026-09-24). Tant que la diffusion n'a pas commencé, on peut rouvrir.
 */
export function SuiviPhotos({ code, initial }: { code: string; initial: EtatSalle }) {
  const t = useTranslations('regie.photos');
  const format = useFormatter();
  const { etat, relire, signaler } = useEtatSalle(code, initial, true);
  const [occupe, demarrer] = useTransition();

  const manche = etat.programme.find((m) => m.jeu === 'photo2' && m.statut !== 'annulee');
  const urls = usePhotosSignees(
    manche?.passages.flatMap((p) => (p.photos ?? []).map((ph) => ph.chemin)) ?? [],
  );
  if (!manche) return <p className="tu-regie__muted">{t('aucuneManche')}</p>;

  const closes = etat.evenement.photos_closes;
  const langue = etat.evenement.langues[0] ?? 'fr';
  const total = manche.passages.length * etat.equipes.length;
  const envoyees = manche.passages.reduce((n, p) => n + (p.photos?.length ?? 0), 0);

  const clore = (fermer: boolean) =>
    demarrer(async () => {
      await supabaseNavigateur()
        .from('evenements')
        .update({ photos_closes_le: fermer ? new Date().toISOString() : null })
        .eq('id', etat.evenement.id);
      // Les téléphones écoutent le même signal que l'écran : ils relisent aussitôt.
      signaler();
      await relire();
    });

  return (
    <div className="tu-regie__section" aria-busy={occupe}>
      <p className="tu-regie-item__title" role="status" data-testid="etat-envois">
        {closes ? t('closes') : t('ouverts')} · {t('envoyees', { n: envoyees, total })}
      </p>
      <div className="tu-cluster">
        {!closes && (
          <BoutonConfirme confirmation={t('confirmerClore')} onConfirm={() => clore(true)}>
            {t('clore')}
          </BoutonConfirme>
        )}
        {closes && manche.statut === 'a_venir' && (
          <Button variant="ghost" onClick={() => clore(false)}>
            {t('rouvrir')}
          </Button>
        )}
      </div>

      {manche.passages.map((p) => (
        <section key={p.id} className="tu-regie__section" aria-labelledby={`theme-${p.id}`}>
          <h2 id={`theme-${p.id}`} className="tu-regie__section-title">
            {t('theme', { n: p.ordre })} ·{' '}
            {texteParLangue(p.public, 'theme', [langue])[0]?.texte ?? '—'}
          </h2>
          <ul className="tu-regie-photos">
            {etat.equipes.map((e) => {
              const photo = p.photos?.find((ph) => ph.equipe_id === e.id);
              const url = photo && urls[photo.chemin];
              return (
                <li key={e.id} className="tu-regie-photo">
                  {url ? (
                    // Miniature d'une URL signée (session de l'animateur).
                    <img className="tu-regie-photo__image" src={url} alt="" />
                  ) : (
                    <span className="tu-regie-photo__image tu-regie-photo__image--vide" />
                  )}
                  <TeamDot index={e.numero} name={e.nom} />
                  <span className="tu-regie__muted">
                    {photo
                      ? t('envoyeeA', {
                          heure: format.dateTime(new Date(photo.envoyee_ms), {
                            hour: '2-digit',
                            minute: '2-digit',
                          }),
                        })
                      : t('pasEnvoyee')}
                    {photo?.gagnante && ` · ${t('gagnante')}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
