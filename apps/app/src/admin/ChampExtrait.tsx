'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DUREE_CONSEILLEE_MS, dureeLisible, type ExtraitDuPassage } from '@/lib/extraits';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/** Une vidéo choisie sur le poste, pas encore envoyée. */
export interface ExtraitChoisi {
  fichier: File;
  adresse: string;
  /** Lue par le navigateur ; `null` s'il ne sait pas lire le fichier. */
  dureeMs: number | null;
}

/** La durée d'une vidéo, lue par le navigateur dans ses métadonnées (`null` s'il n'y arrive pas). */
function lireDuree(adresse: string): Promise<number | null> {
  return new Promise((resoudre) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const fin = (duree: number | null) => {
      video.removeAttribute('src');
      video.load();
      resoudre(duree);
    };
    video.onloadedmetadata = () =>
      fin(Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null);
    video.onerror = () => fin(null);
    video.src = adresse;
  });
}

/**
 * La vidéo d'une scène du Ciné-mime (2026-11-20), au back-office : la vidéo actuelle (lue par URL
 * signée), le choix d'une autre, son aperçu et sa durée avant l'envoi. Le fichier ne part qu'à
 * « Enregistrer », du navigateur droit vers le stockage (`FormulaireContenu`). Le choix vit dans
 * le formulaire, qui libère l'adresse locale d'une vidéo remplacée : ce champ est remonté après
 * chaque réponse du serveur, le choix doit lui survivre.
 */
export function ChampExtrait({
  existant,
  choisi,
  onChoisir,
  erreur,
  desactive,
}: {
  existant: ExtraitDuPassage | null;
  choisi: ExtraitChoisi | null;
  onChoisir: (choisi: ExtraitChoisi | null) => void;
  erreur: string | null;
  desactive: boolean;
}) {
  const t = useTranslations('admin.formulaire.extrait');
  const [adresseExistant, setAdresseExistant] = useState<string | null>(null);

  useEffect(() => {
    if (!existant) return;
    let actif = true;
    void supabaseNavigateur()
      .storage.from('extraits')
      .createSignedUrl(existant.chemin, 3600)
      .then(({ data }) => {
        if (actif) setAdresseExistant(data?.signedUrl ?? null);
      });
    return () => {
      actif = false;
    };
  }, [existant]);

  const apercu = choisi?.adresse ?? adresseExistant;
  const duree = choisi ? choisi.dureeMs : (existant?.dureeMs ?? null);

  return (
    <fieldset className="tu-admin-langue">
      <legend>{t('titre')}</legend>
      <p className="tu-admin-langue__aide">{t('aide')}</p>
      <label className="tu-field">
        <span className="tu-field__label">{t('fichier')}</span>
        <input
          className="tu-field__control"
          type="file"
          name="video"
          accept="video/mp4,.mp4"
          disabled={desactive}
          aria-invalid={erreur !== null}
          data-testid="extrait-fichier"
          onChange={(e) => {
            const fichier = e.currentTarget.files?.[0];
            if (!fichier) return onChoisir(null);
            const adresse = URL.createObjectURL(fichier);
            void lireDuree(adresse).then((dureeMs) => onChoisir({ fichier, adresse, dureeMs }));
          }}
        />
        {erreur && <span className="tu-field__error">{erreur}</span>}
      </label>
      {apercu && (
        <div className="tu-admin-extrait">
          {/* L'aperçu d'une scène avant de l'enregistrer : rien à sous-titrer. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            className="tu-admin-extrait__video"
            src={apercu}
            controls
            preload="metadata"
            playsInline
            data-testid="extrait-apercu"
          />
          {duree !== null && (
            <p className="tu-regie__muted" data-testid="extrait-duree">
              {t(choisi ? 'nouvelle' : 'actuelle', { duree: dureeLisible(duree) })}
            </p>
          )}
          {duree !== null && duree > DUREE_CONSEILLEE_MS && (
            <p className="tu-regie__muted">{t('longue')}</p>
          )}
          {!choisi && <p className="tu-regie__muted">{t('remplacer')}</p>}
        </div>
      )}
    </fieldset>
  );
}
