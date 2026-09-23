'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { COOKIE_LANGUE, type EtatJoueur, type Langue } from '@/lib/partie';
import { Cadre } from './Cadre';
import { EcranJoueur } from './EcranJoueur';

/**
 * Chaque langue se présente dans sa propre langue : à cette étape, on ne sait pas encore
 * laquelle le joueur lit. Ce sont les seuls textes hors des fichiers de messages.
 */
const LANGUES: Record<Langue, { nom: string; titre: string }> = {
  fr: { nom: 'Français', titre: 'Ta langue' },
  en: { nom: 'English', titre: 'Your language' },
  ta: { nom: 'தமிழ்', titre: 'உங்கள் மொழி' },
};

const UN_AN_S = 365 * 24 * 60 * 60;

/** La langue suit le joueur d'une salle à l'autre : le serveur la lit pour choisir les textes. */
function memoriserLangue(langue: Langue) {
  document.cookie = `${COOKIE_LANGUE}=${langue}; path=/; max-age=${UN_AN_S}; samesite=lax`;
}

type Erreur = 'vide' | 'complet' | 'codeInconnu' | 'serveur';

/** Langue, puis prénom, puis « Mon équipe ». */
export function Arrivee({
  code,
  langues,
  langueCourante,
}: {
  code: string;
  langues: Langue[];
  /** Langue des textes affichés, d'après le cookie. */
  langueCourante: Langue;
}) {
  const t = useTranslations('prenom');
  const router = useRouter();
  const [langue, setLangue] = useState<Langue | null>(
    // Une seule langue, déjà celle des textes : aucun choix à faire. Sinon on demande, même
    // avec un seul bouton, pour que le cookie et les textes suivent.
    langues.length === 1 && langues[0] === langueCourante ? langueCourante : null,
  );
  const [prenom, setPrenom] = useState('');
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);
  const [rejoint, setRejoint] = useState<EtatJoueur | null>(null);

  const choisir = (choisie: Langue) => {
    memoriserLangue(choisie);
    setLangue(choisie);
    // Les textes suivants arrivent dans la langue choisie, sans quitter l'écran.
    router.refresh();
  };

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!prenom.trim()) return setErreur('vide');
    setEnvoi(true);
    setErreur(undefined);
    try {
      const reponse = await fetch(`/api/partie/${code}/rejoindre`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prenom, langue }),
      });
      if (reponse.ok) return setRejoint((await reponse.json()) as EtatJoueur);
      setErreur(
        reponse.status === 409 ? 'complet' : reponse.status === 404 ? 'codeInconnu' : 'serveur',
      );
    } catch {
      setErreur('serveur');
    } finally {
      setEnvoi(false);
    }
  };

  if (rejoint) return <EcranJoueur code={code} etatInitial={rejoint} vueInitiale="equipe" />;

  if (!langue) {
    return (
      <Cadre>
        <div className="tu-player__body">
          <h1 className="tu-player__title">
            {langues.map((l) => (
              <span key={l} lang={l} className="tu-player__title-line">
                {LANGUES[l].titre}
              </span>
            ))}
          </h1>
          <ul className="tu-choices">
            {langues.map((l) => (
              <li key={l}>
                <Button variant="outline" size="lg" block lang={l} onClick={() => choisir(l)}>
                  {LANGUES[l].nom}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Cadre>
    );
  }

  return (
    <Cadre>
      <form className="tu-player__body" onSubmit={(e) => void envoyer(e)} noValidate>
        <h1 className="tu-player__title">{t('titre')}</h1>
        <TextField
          label={t('champ')}
          hint={t('aide')}
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="go"
          required
          {...(erreur ? { error: t(erreur) } : {})}
        />
        <div className="tu-player__actions">
          <Button type="submit" variant="accent" size="lg" block disabled={envoi}>
            {t('bouton')}
          </Button>
        </div>
      </form>
    </Cadre>
  );
}
