'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formerEquipes, MAX_EQUIPES, MIN_EQUIPES, tirerContenus } from '@teamup/game';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';
import type { Json } from '@/types/base';
import { BoutonConfirme } from './BoutonConfirme';
import { useSignalSalle } from './SignalSalle';

export interface InscritDeLaFormation {
  id: string;
  prenom: string;
  groupe_id: string | null;
  volontaire: boolean;
  nom_propose: string | null;
  sansTelephone: boolean;
}

/** Une manche jouée une équipe à la fois (Points communs, Mime) et sa réserve de contenus. */
export interface MancheParEquipe {
  id: string;
  tours: number;
  reserve: string[];
}

/** Un hasard sûr, celui du navigateur, comme le tirage de l'ordre (lot 13). */
function aleaCrypto(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

/**
 * Formation des équipes (lot 14) : l'animateur choisit le nombre d'équipes et lance. Le calcul se
 * fait ici (groupes mélangés, capitaines volontaires et leur nom, contenus tirés dans la réserve),
 * l'écriture d'un bloc par `former_equipes`. Tant qu'aucun jeu n'a commencé, on peut refaire.
 */
export function FormationEquipes({
  evenementId,
  equipesPrevues,
  inscrits,
  manches,
  formees,
  verrouillee,
}: {
  evenementId: string;
  equipesPrevues: number;
  inscrits: InscritDeLaFormation[];
  manches: MancheParEquipe[];
  /** Les équipes existent déjà : le bouton devient « Refaire les équipes ». */
  formees: boolean;
  /** Un jeu a commencé, ou des photos et des points existent : on ne refait plus. */
  verrouillee: boolean;
}) {
  const t = useTranslations('regie.salle.formation');
  const tDefaut = useTranslations('regie.evenements');
  const router = useRouter();
  const signaler = useSignalSalle();
  const [nombre, setNombre] = useState(
    Math.min(MAX_EQUIPES, Math.max(MIN_EQUIPES, equipesPrevues)),
  );
  const [erreur, setErreur] = useState<string>();
  const [enCours, demarrer] = useTransition();

  if (formees && verrouillee) return null;

  const volontaires = inscrits.filter((j) => j.volontaire && !j.sansTelephone);
  const manque = manches.find((m) => new Set(m.reserve).size < nombre * m.tours);

  const former = () =>
    demarrer(async () => {
      setErreur(undefined);
      if (inscrits.length < nombre) return setErreur(t('tropPeu'));
      if (manque) return setErreur(t('reserve'));
      const equipes = formerEquipes({
        inscrits: inscrits.map((j) => ({
          id: j.id,
          groupe: j.groupe_id,
          volontaire: j.volontaire,
          nomPropose: j.nom_propose,
          telephone: !j.sansTelephone,
        })),
        nbEquipes: nombre,
        alea: aleaCrypto,
      });
      const numeros = equipes.map((e) => String(e.numero));
      const passages = manches.flatMap((m) =>
        tirerContenus(m.reserve, numeros, m.tours, aleaCrypto).map((p) => ({
          manche_id: m.id,
          numero: Number(p.equipe),
          contenu_id: p.contenu,
          ordre: p.ordre,
        })),
      );
      const { error } = await supabaseNavigateur().rpc('former_equipes', {
        p_evenement: evenementId,
        p_equipes: equipes.map((e) => ({
          numero: e.numero,
          nom: e.nom ?? tDefaut('equipeParDefaut', { numero: e.numero }),
          capitaine: e.capitaine,
          membres: e.membres,
        })) as unknown as Json,
        p_passages: passages as unknown as Json,
      });
      if (error) {
        setErreur(/commencé|photos/.test(error.message) ? t('tropTard') : t('echec'));
        return;
      }
      signaler();
      router.refresh();
    });

  return (
    <section className="tu-regie__section" aria-labelledby="formation" data-testid="formation">
      <h2 id="formation" className="tu-regie__section-title">
        {t(formees ? 'titreRefaire' : 'titre')}
      </h2>
      <p className="tu-regie__muted">
        {t('inscrits', { n: inscrits.length, volontaires: volontaires.length })}
      </p>
      {formees && (
        <p className="tu-regie__muted" data-testid="devoiler-au-pilotage">
          {t('devoilerAuPilotage')}
        </p>
      )}
      {volontaires.length > 0 && (
        <p className="tu-regie__muted" data-testid="noms-proposes">
          {volontaires
            .map((j) => (j.nom_propose ? `${j.prenom} (« ${j.nom_propose} »)` : j.prenom))
            .join(' · ')}
        </p>
      )}
      <div className="tu-regie-item">
        <label className="tu-field">
          <span className="tu-field__label">{t('nombre')}</span>
          <input
            className="tu-field__control"
            type="number"
            min={MIN_EQUIPES}
            max={MAX_EQUIPES}
            value={nombre}
            onChange={(e) =>
              setNombre(
                Math.min(MAX_EQUIPES, Math.max(MIN_EQUIPES, Number(e.target.value) || MIN_EQUIPES)),
              )
            }
            data-testid="nombre-equipes"
          />
        </label>
        {formees ? (
          <BoutonConfirme
            variant="ghost"
            confirmation={t('confirmerRefaire')}
            onConfirm={former}
            disabled={enCours}
            data-testid="refaire-equipes"
          >
            {t('refaire')}
          </BoutonConfirme>
        ) : (
          <BoutonConfirme
            confirmation={t('confirmer', { n: nombre })}
            onConfirm={former}
            disabled={enCours || inscrits.length === 0}
            data-testid="former-equipes"
          >
            {t('former')}
          </BoutonConfirme>
        )}
      </div>
      {manque && (
        <p className="tu-regie__alert" role="status">
          {t('reserve')}
        </p>
      )}
      {erreur && (
        <p className="tu-regie__alert" role="alert">
          {erreur}
        </p>
      )}
    </section>
  );
}
