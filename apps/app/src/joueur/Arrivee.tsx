'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, cx, TextField } from '@teamup/ui/react';
import { DRAPEAUX, memoriserLangue, NOMS_LANGUES } from '@/lib/langue-navigateur';
import type { EtatJoueur, GroupePublic, Langue } from '@/lib/partie';
import { Cadre } from './Cadre';
import { ChoixLangueJoueur } from './ChoixLangueJoueur';
import { EcranJoueur } from './EcranJoueur';

/**
 * Chaque langue se présente dans sa propre langue : à cette étape, on ne sait pas encore
 * laquelle le joueur lit. Ce sont les seuls textes hors des fichiers de messages.
 */
const TITRES: Record<Langue, string> = {
  fr: 'Votre langue',
  en: 'Your language',
  ta: 'உங்கள் மொழி',
};

type Erreur = 'vide' | 'pris' | 'groupe' | 'complet' | 'codeInconnu' | 'serveur';

/** Sans réponse dans ce délai, le téléphone rend la main : le nouvel essai est sans risque. */
const DELAI_ENVOI_MS = 12_000;

/**
 * L'identifiant de cette inscription, gardé dans l'onglet jusqu'à sa réussite : si la réponse se
 * perd, le nouvel essai (même après un rechargement) retrouve la fiche déjà créée.
 */
function demandeDe(code: string, secours: { current: string | null }): string {
  const cle = `tu_arrivee_${code}`;
  try {
    const gardee = sessionStorage.getItem(cle);
    if (gardee) return gardee;
  } catch {
    // Stockage refusé : la demande vit en mémoire, le temps de cet écran.
  }
  if (secours.current) return secours.current;
  const octets = crypto.getRandomValues(new Uint8Array(24));
  const demande = Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('');
  secours.current = demande;
  try {
    sessionStorage.setItem(cle, demande);
  } catch {
    // Voir plus haut.
  }
  return demande;
}

function oublierDemande(code: string, secours: { current: string | null }) {
  secours.current = null;
  try {
    sessionStorage.removeItem(`tu_arrivee_${code}`);
  } catch {
    // Rien à oublier.
  }
}

/**
 * La langue si la soirée en propose le choix, puis deux étapes : « Votre inscription » (prénom et
 * groupe si la soirée en a) et « Votre rôle » (membre ou volontaire pour être capitaine, avec un
 * nom d'équipe proposé). Rien n'est affiché comme confirmé avant la réponse du serveur ; un refus
 * ou une coupure garde toutes les saisies.
 */
export function Arrivee({
  code,
  langues,
  groupes,
  groupeFacultatif = true,
  langueCourante,
  langueDejaChoisie = false,
}: {
  code: string;
  langues: Langue[];
  groupes: GroupePublic[];
  /** L'animateur laisse-t-il « Je préfère ne pas répondre » ? La base le vérifie aussi. */
  groupeFacultatif?: boolean;
  /** Langue des textes affichés, d'après le cookie. */
  langueCourante: Langue;
  /** Venu de la carte Team Up!, où la langue est déjà choisie (une langue de la soirée). */
  langueDejaChoisie?: boolean;
}) {
  const t = useTranslations('prenom');
  const tGroupe = useTranslations('groupe');
  const tCapitaine = useTranslations('capitaine');
  const router = useRouter();
  const idGroupe = useId();
  const [langue, setLangue] = useState<Langue | null>(
    // Une seule langue, déjà celle des textes : aucun choix à faire. Sinon on demande, même
    // avec un seul bouton, pour que le cookie et les textes suivent.
    // Venu de la carte, la langue choisie là-bas vaut choix.
    langueDejaChoisie || (langues.length === 1 && langues[0] === langueCourante)
      ? langueCourante
      : null,
  );
  const [etape, setEtape] = useState<'identite' | 'role'>('identite');
  const [prenom, setPrenom] = useState('');
  const [groupe, setGroupe] = useState('');
  const [volontaire, setVolontaire] = useState(false);
  const [nomPropose, setNomPropose] = useState('');
  const [erreur, setErreur] = useState<Erreur>();
  const [envoi, setEnvoi] = useState(false);
  const [rejoint, setRejoint] = useState<EtatJoueur | null>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const enCours = useRef(false);
  const secoursDemande = useRef<string | null>(null);

  // L'erreur d'un champ y ramène le doigt et le lecteur d'écran.
  useEffect(() => {
    if (erreur === 'vide' || erreur === 'pris' || erreur === 'groupe') {
      formulaire.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  }, [erreur, etape]);

  const choisir = (choisie: Langue) => {
    memoriserLangue(choisie);
    setLangue(choisie);
    // Les textes suivants arrivent dans la langue choisie, sans quitter l'écran.
    router.refresh();
  };
  // Une fois la langue choisie, elle reste changeable à chaque étape de l'arrivée.
  const outilLangue = langue ? <ChoixLangueJoueur langues={langues} choisir={choisir} /> : null;

  const validerIdentite = async (e: FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    if (!prenom.trim()) return setErreur('vide');
    if (groupes.length > 0 && !groupeFacultatif && !groupe) return setErreur('groupe');
    setErreur(undefined);
    // Un doublon se refuse dès cet écran ; sans réponse du serveur, on continue : l'inscription
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
    setEtape('role');
  };

  const confirmer = async (e: FormEvent) => {
    e.preventDefault();
    // Un seul envoi, même sur un double appui : le bouton ne se grise qu'au rendu suivant.
    if (enCours.current) return;
    enCours.current = true;
    setEnvoi(true);
    setErreur(undefined);
    try {
      const reponse = await fetch(`/api/partie/${code}/rejoindre`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(DELAI_ENVOI_MS),
        body: JSON.stringify({
          prenom,
          langue,
          groupe: groupe || null,
          volontaire,
          nom: volontaire && nomPropose.trim() ? nomPropose.trim() : null,
          demande: demandeDe(code, secoursDemande),
        }),
      });
      if (reponse.ok) {
        const etat = (await reponse.json()) as EtatJoueur;
        oublierDemande(code, secoursDemande);
        return setRejoint(etat);
      }
      const { erreur: refus } = (await reponse.json().catch(() => ({}))) as { erreur?: string };
      if (refus === 'prenom_pris') {
        // Pris entre-temps par un autre : retour au prénom, les autres réponses restent.
        setEtape('identite');
        return setErreur('pris');
      }
      if (refus === 'groupe') {
        setEtape('identite');
        return setErreur('groupe');
      }
      setErreur(
        reponse.status === 409 ? 'complet' : reponse.status === 404 ? 'codeInconnu' : 'serveur',
      );
    } catch {
      setErreur('serveur');
    } finally {
      enCours.current = false;
      setEnvoi(false);
    }
  };

  if (rejoint) {
    return <EcranJoueur code={code} etatInitial={rejoint} groupes={groupes} />;
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
                  {DRAPEAUX[l] && <span aria-hidden="true">{DRAPEAUX[l]}</span>}
                  {NOMS_LANGUES[l]}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </Cadre>
    );
  }

  if (etape === 'role') {
    return (
      <Cadre outil={outilLangue}>
        <form
          ref={formulaire}
          className="tu-player__body"
          onSubmit={(e) => void confirmer(e)}
          noValidate
        >
          <p className="tu-avis__etape">{t('etape', { n: 2 })}</p>
          <h1 className="tu-player__title">{tCapitaine('titre')}</h1>
          <fieldset className="tu-roles">
            <legend className="tu-visually-hidden">{tCapitaine('titre')}</legend>
            <label className="tu-role">
              <input
                type="radio"
                name="role"
                checked={!volontaire}
                onChange={() => setVolontaire(false)}
              />
              <span>{tCapitaine('membre')}</span>
            </label>
            <label className="tu-role">
              <input
                type="radio"
                name="role"
                checked={volontaire}
                onChange={() => setVolontaire(true)}
              />
              <span>{tCapitaine('volontaire')}</span>
            </label>
          </fieldset>
          {/* Un `details` : le toucher et Entrée déplient l'aide sans toucher au choix du rôle. */}
          <details className="tu-role-info" data-testid="bulle-capitaine">
            <summary>
              <span className="tu-role-info__i" aria-hidden="true">
                i
              </span>
              {tCapitaine('question')}
            </summary>
            <p>{tCapitaine('explication')}</p>
          </details>
          {volontaire && (
            <TextField
              label={tCapitaine('nomChamp')}
              value={nomPropose}
              onChange={(e) => setNomPropose(e.target.value)}
              maxLength={24}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="go"
            />
          )}
          {erreur && (
            <p className="tu-player__error" role="alert" data-testid="erreur-inscription">
              {t(erreur, { prenom: prenom.trim() })}
            </p>
          )}
          <div className="tu-player__actions">
            <Button type="submit" variant="accent" size="lg" block disabled={envoi}>
              {envoi ? t('connexion') : tCapitaine('confirmer')}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              block
              disabled={envoi}
              onClick={() => {
                setErreur(undefined);
                setEtape('identite');
              }}
            >
              {tCapitaine('precedent')}
            </Button>
          </div>
        </form>
      </Cadre>
    );
  }

  const erreurGroupe = erreur === 'groupe';
  return (
    <Cadre outil={outilLangue}>
      <form
        ref={formulaire}
        className="tu-player__body"
        onSubmit={(e) => void validerIdentite(e)}
        noValidate
      >
        <p className="tu-avis__etape">{t('etape', { n: 1 })}</p>
        <h1 className="tu-player__title">{t('titre')}</h1>
        <TextField
          label={t('champ')}
          hint={t('aide')}
          value={prenom}
          onChange={(e) => {
            setPrenom(e.target.value);
            if (erreur === 'pris' || erreur === 'vide') setErreur(undefined);
          }}
          maxLength={40}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="next"
          required
          {...(erreur === 'vide' || erreur === 'pris'
            ? { error: t(erreur, { prenom: prenom.trim() }) }
            : {})}
        />
        {groupes.length > 0 && (
          <div className={cx('tu-field', erreurGroupe && 'tu-field--invalid')}>
            <label className="tu-field__label" htmlFor={idGroupe}>
              {tGroupe(groupeFacultatif ? 'champFacultatif' : 'champ')}
            </label>
            <select
              id={idGroupe}
              className="tu-field__control"
              value={groupe}
              required={!groupeFacultatif}
              aria-invalid={erreurGroupe}
              aria-describedby={`${idGroupe}-aide${erreurGroupe ? ` ${idGroupe}-erreur` : ''}`}
              onChange={(e) => {
                setGroupe(e.target.value);
                if (erreurGroupe) setErreur(undefined);
              }}
            >
              <option value="" disabled={!groupeFacultatif}>
                {tGroupe(groupeFacultatif ? 'sansReponse' : 'choisir')}
              </option>
              {groupes.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nom}
                </option>
              ))}
            </select>
            <p className="tu-field__hint" id={`${idGroupe}-aide`}>
              {tGroupe('aide')}
            </p>
            {erreurGroupe && (
              <p className="tu-field__error" id={`${idGroupe}-erreur`}>
                {t('groupe')}
              </p>
            )}
          </div>
        )}
        <div className="tu-player__actions">
          <Button type="submit" variant="accent" size="lg" block disabled={envoi}>
            {t('bouton')}
          </Button>
        </div>
      </form>
    </Cadre>
  );
}
