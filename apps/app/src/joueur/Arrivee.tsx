'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { memoriserLangue, NOMS_LANGUES } from '@/lib/langue-navigateur';
import type { EtatJoueur, GroupePublic, Langue } from '@/lib/partie';
import { Cadre } from './Cadre';
import { EcranJoueur } from './EcranJoueur';

/**
 * Chaque langue se présente dans sa propre langue : à cette étape, on ne sait pas encore
 * laquelle le joueur lit. Ce sont les seuls textes hors des fichiers de messages.
 */
const TITRES: Record<Langue, string> = {
  fr: 'Ta langue',
  en: 'Your language',
  ta: 'உங்கள் மொழி',
};

type Erreur = 'vide' | 'complet' | 'codeInconnu' | 'serveur';

/**
 * Langue, puis prénom, puis groupe si la soirée en a (lot 11), puis « Capitaine ? », puis
 * « Mon équipe ». Le groupe et le volontariat ne partent qu'avec l'arrivée : le groupe sert au
 * tirage de l'équipe (rien ne le garde), le volontariat au tirage des capitaines par la régie.
 */
export function Arrivee({
  code,
  langues,
  groupes,
  langueCourante,
}: {
  code: string;
  langues: Langue[];
  groupes: GroupePublic[];
  /** Langue des textes affichés, d'après le cookie. */
  langueCourante: Langue;
}) {
  const t = useTranslations('prenom');
  const tGroupe = useTranslations('groupe');
  const tCapitaine = useTranslations('capitaine');
  const router = useRouter();
  const [langue, setLangue] = useState<Langue | null>(
    // Une seule langue, déjà celle des textes : aucun choix à faire. Sinon on demande, même
    // avec un seul bouton, pour que le cookie et les textes suivent.
    langues.length === 1 && langues[0] === langueCourante ? langueCourante : null,
  );
  const [prenom, setPrenom] = useState('');
  const [etapeGroupe, setEtapeGroupe] = useState(false);
  const [etapeCapitaine, setEtapeCapitaine] = useState(false);
  const [groupe, setGroupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);
  const [rejoint, setRejoint] = useState<EtatJoueur | null>(null);

  const choisir = (choisie: Langue) => {
    memoriserLangue(choisie);
    setLangue(choisie);
    // Les textes suivants arrivent dans la langue choisie, sans quitter l'écran.
    router.refresh();
  };

  const validerPrenom = (e: FormEvent) => {
    e.preventDefault();
    if (!prenom.trim()) return setErreur('vide');
    setErreur(undefined);
    if (groupes.length > 0) return setEtapeGroupe(true);
    setEtapeCapitaine(true);
  };

  const choisirGroupe = (choisi: string | null) => {
    setGroupe(choisi);
    setEtapeGroupe(false);
    setEtapeCapitaine(true);
  };

  const envoyer = async (volontaire: boolean) => {
    setEnvoi(true);
    setErreur(undefined);
    try {
      const reponse = await fetch(`/api/partie/${code}/rejoindre`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prenom, langue, groupe, volontaire }),
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

  if (rejoint) {
    return <EcranJoueur code={code} etatInitial={rejoint} vueInitiale="equipe" groupes={groupes} />;
  }

  if (!langue) {
    return (
      <Cadre>
        <div className="tu-player__body">
          <h1 className="tu-player__title">
            {langues.map((l) => (
              <span key={l} lang={l} className="tu-player__title-line">
                {TITRES[l]}
              </span>
            ))}
          </h1>
          <ul className="tu-choices">
            {langues.map((l) => (
              <li key={l}>
                <Button variant="outline" size="lg" block lang={l} onClick={() => choisir(l)}>
                  {NOMS_LANGUES[l]}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Cadre>
    );
  }

  if (etapeGroupe) {
    return (
      <Cadre>
        <div className="tu-player__body">
          <h1 className="tu-player__title">{tGroupe('titre')}</h1>
          <p className="tu-player__lead">{tGroupe('aide')}</p>
          <ul className="tu-choices">
            {groupes.map((g) => (
              <li key={g.id}>
                <Button variant="outline" size="lg" block onClick={() => choisirGroupe(g.id)}>
                  {g.nom}
                </Button>
              </li>
            ))}
            <li>
              <Button variant="ghost" size="lg" block onClick={() => choisirGroupe(null)}>
                {tGroupe('sansReponse')}
              </Button>
            </li>
          </ul>
        </div>
      </Cadre>
    );
  }

  if (etapeCapitaine) {
    return (
      <Cadre>
        <div className="tu-player__body">
          <h1 className="tu-player__title">{tCapitaine('titre')}</h1>
          <p className="tu-player__lead">{tCapitaine('aide')}</p>
          <ul className="tu-choices">
            <li>
              <Button
                variant="outline"
                size="lg"
                block
                disabled={envoi}
                onClick={() => void envoyer(true)}
              >
                {tCapitaine('oui')}
              </Button>
            </li>
            <li>
              <Button
                variant="ghost"
                size="lg"
                block
                disabled={envoi}
                onClick={() => void envoyer(false)}
              >
                {tCapitaine('non')}
              </Button>
            </li>
          </ul>
          {erreur && (
            <p className="tu-player__error" role="alert">
              {t(erreur)}
            </p>
          )}
        </div>
      </Cadre>
    );
  }

  return (
    <Cadre>
      <form className="tu-player__body" onSubmit={validerPrenom} noValidate>
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
