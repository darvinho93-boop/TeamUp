'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { cheminMusique, refusMusique, TITRE_MAX_MUSIQUE, type RefusMusique } from '@/lib/musiques';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/**
 * Ajouter une musique : le fichier part du navigateur droit vers le stockage, sous la session de
 * l'admin (une fonction Vercel plafonne une requête à 4,5 Mo, trop peu pour un MP3). Le bucket
 * refuse de lui-même un autre type ou plus de 15 Mo ; ici, on vérifie avant d'envoyer que le
 * fichier est bien un MP3, pour un message clair.
 */
export function FormulaireMusique() {
  const t = useTranslations('admin.musiques');
  const router = useRouter();
  const formulaire = useRef<HTMLFormElement>(null);
  const [erreur, setErreur] = useState<RefusMusique | 'envoi' | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function ajouter(donnees: FormData) {
    setErreur(null);
    setOk(null);
    const brut = donnees.get('titre');
    const titre = typeof brut === 'string' ? brut.trim() : '';
    const brutArtiste = donnees.get('artiste');
    // La réponse du blind test : « titre — artiste ». Facultatif.
    const artiste =
      typeof brutArtiste === 'string' && brutArtiste.trim()
        ? brutArtiste.trim().slice(0, TITRE_MAX_MUSIQUE)
        : null;
    const fichier = donnees.get('fichier');
    if (!(fichier instanceof File)) return setErreur('vide');
    const debut = new Uint8Array(await fichier.slice(0, 4).arrayBuffer());
    const refus = refusMusique(titre, { taille: fichier.size, debut });
    if (refus) return setErreur(refus);

    setEnCours(true);
    const supabase = supabaseNavigateur();
    const chemin = cheminMusique(crypto.randomUUID());
    const depot = await supabase.storage
      .from('musiques')
      .upload(chemin, fichier, { contentType: 'audio/mpeg', upsert: false });
    const ligne = depot.error
      ? depot
      : await supabase.from('musiques').insert({ titre, artiste, chemin, taille: fichier.size });
    setEnCours(false);
    if (ligne.error) {
      // Fichier déposé sans sa ligne : on le retire, sinon il resterait orphelin.
      if (!depot.error) await supabase.storage.from('musiques').remove([chemin]);
      return setErreur('envoi');
    }
    setOk(t('ajoutee', { titre }));
    formulaire.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={formulaire}
      className="tu-regie__section"
      onSubmit={(e) => {
        e.preventDefault();
        void ajouter(new FormData(e.currentTarget));
      }}
    >
      <div className="tu-regie__form">
        <TextField
          label={t('titreMusique')}
          name="titre"
          required
          maxLength={TITRE_MAX_MUSIQUE}
          autoComplete="off"
        />
        <TextField
          label={t('artiste')}
          name="artiste"
          maxLength={TITRE_MAX_MUSIQUE}
          autoComplete="off"
        />
        <label className="tu-field">
          <span className="tu-field__label">{t('fichier')}</span>
          <input
            className="tu-field__control"
            type="file"
            name="fichier"
            accept="audio/mpeg,.mp3"
            required
            disabled={enCours}
          />
        </label>
      </div>
      <p className="tu-regie__muted">{t('aideFichier')}</p>
      {erreur && (
        <p className="tu-regie__alert" role="alert" data-testid="musique-erreur">
          {t(`erreur.${erreur}`)}
        </p>
      )}
      {ok && (
        <p className="tu-regie__muted" role="status">
          {ok}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" disabled={enCours}>
          {enCours ? t('envoi') : t('ajouterBouton')}
        </Button>
      </div>
    </form>
  );
}
