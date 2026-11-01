'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, TextField } from '@teamup/ui/react';
import { memoriserLangue, NOMS_LANGUES } from '@/lib/langue-navigateur';
import type { EtatJoueur, GroupePublic, Langue } from '@/lib/partie';
import { Cadre } from './Cadre';
import { ChoixLangueJoueur } from './ChoixLangueJoueur';
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

type Erreur = 'vide' | 'pris' | 'complet' | 'codeInconnu' | 'serveur';

/**
 * Langue, puis prénom, puis groupe si la soirée en a (lot 11), puis « Capitaine ? » et, pour un
 * volontaire, le nom d'équipe qu'il propose (lot 14). Ensuite « Mon équipe » si la soirée a déjà
 * ses équipes, sinon la page d'explication puis l'attente de la formation par la régie.
 */
export function Arrivee({
  code,
  langues,
  groupes,
  groupeFacultatif = true,
  langueCourante,
}: {
  code: string;
  langues: Langue[];
  groupes: GroupePublic[];
  /** L'animateur laisse-t-il « Je préfère ne pas répondre » ? La base le vérifie aussi. */
  groupeFacultatif?: boolean;
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
  const [etapeNom, setEtapeNom] = useState(false);
  const [nomPropose, setNomPropose] = useState('');
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
  // Une fois la langue choisie, elle reste changeable à chaque étape de l'arrivée.
  const outilLangue = langue ? <ChoixLangueJoueur langues={langues} choisir={choisir} /> : null;

  const validerPrenom = async (e: FormEvent) => {
    e.preventDefault();
    if (!prenom.trim()) return setErreur('vide');
    setErreur(undefined);
    // Un doublon se refuse dès cet écran ; sans réponse du serveur, on continue : l'arrivée
    // revérifie et ramène ici au besoin.
    setEnvoi(true);
    try {
      const reponse = await fetch(`/api/partie/${code}/prenom`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prenom }),
      });
      if (reponse.ok && !((await reponse.json()) as { libre: boolean }).libre) {
        return setErreur('pris');
      }
    } catch {
      // Réseau : voir plus haut.
    } finally {
      setEnvoi(false);
    }
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
        body: JSON.stringify({
          prenom,
          langue,
          groupe,
          volontaire,
          nom: volontaire && nomPropose.trim() ? nomPropose.trim() : null,
        }),
      });
      if (reponse.ok) return setRejoint((await reponse.json()) as EtatJoueur);
      const { erreur: code_ } = (await reponse.json().catch(() => ({}))) as { erreur?: string };
      if (code_ === 'prenom_pris') {
        // Pris entre-temps par un autre : retour au prénom, le choix du groupe sera redemandé.
        setEtapeCapitaine(false);
        setEtapeNom(false);
        setEtapeGroupe(false);
        return setErreur('pris');
      }
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
    return (
      <EcranJoueur
        code={code}
        etatInitial={rejoint}
        // Sans équipe (lot 14) : la page d'explication, puis l'attente de la formation.
        vueInitiale={rejoint.equipe ? 'equipe' : 'explication'}
        groupes={groupes}
      />
    );
  }

  if (etapeNom) {
    return (
      <Cadre outil={outilLangue}>
        <form
          className="tu-player__body"
          onSubmit={(e) => {
            e.preventDefault();
            void envoyer(true);
          }}
          noValidate
        >
          <h1 className="tu-player__title">{tCapitaine('nomTitre')}</h1>
          <p className="tu-player__lead">{tCapitaine('nomAide')}</p>
          <TextField
            label={tCapitaine('nomChamp')}
            value={nomPropose}
            onChange={(e) => setNomPropose(e.target.value)}
            maxLength={24}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="go"
            {...(erreur ? { error: t(erreur, { prenom: prenom.trim() }) } : {})}
          />
          <div className="tu-player__actions">
            <Button type="submit" variant="accent" size="lg" block disabled={envoi}>
              {tCapitaine('nomBouton')}
            </Button>
          </div>
        </form>
      </Cadre>
    );
  }

  if (!langue) {
    return (
      <Cadre outil={outilLangue}>
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
      <Cadre outil={outilLangue}>
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
            {groupeFacultatif && (
              <li>
                <Button variant="ghost" size="lg" block onClick={() => choisirGroupe(null)}>
                  {tGroupe('sansReponse')}
                </Button>
              </li>
            )}
          </ul>
        </div>
      </Cadre>
    );
  }

  if (etapeCapitaine) {
    return (
      <Cadre outil={outilLangue}>
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
                onClick={() => {
                  setEtapeCapitaine(false);
                  setEtapeNom(true);
                }}
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
              {t(erreur, { prenom: prenom.trim() })}
            </p>
          )}
        </div>
      </Cadre>
    );
  }

  return (
    <Cadre outil={outilLangue}>
      <form className="tu-player__body" onSubmit={(e) => void validerPrenom(e)} noValidate>
        <h1 className="tu-player__title">{t('titre')}</h1>
        <TextField
          label={t('champ')}
          hint={t('aide')}
          value={prenom}
          onChange={(e) => {
            setPrenom(e.target.value);
            if (erreur === 'pris') setErreur(undefined);
          }}
          maxLength={40}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="go"
          required
          {...(erreur ? { error: t(erreur, { prenom: prenom.trim() }) } : {})}
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
