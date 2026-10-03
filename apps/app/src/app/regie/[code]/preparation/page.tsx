import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button, TeamDot } from '@teamup/ui/react';
import {
  CHRONO_SURENCHERE_DEFAUT_S,
  DUELS_DEFAUT,
  dureeProgramme,
  formatDuree,
  QUESTIONS_QUIZ,
  QUESTIONS_QUIZ_DEFAUT,
} from '@teamup/game';
import { etiquettesDe, libelleContenu, proposable } from '@/lib/contenus';
import { MAX_GROUPES } from '@/lib/groupes';
import { elementDuProgramme } from '@/lib/programme';
import { evenementDeLaRegie } from '@/serveur/regie';
import { SelectContenu, type OptionContenu } from '@/regie/SelectContenu';
import {
  ajouterDuels,
  ajouterEquipe,
  ajouterMime,
  ajouterPhoto,
  ajouterPointsCommuns,
  ajouterQuiz,
  ajouterSurenchere,
  deplacerManche,
  enregistrerGroupes,
  renommerEquipes,
  retirerEquipe,
  retirerManche,
} from './actions';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.nav'))('preparation') };
}

type Valeur = Record<string, unknown>;

export default async function Preparation({
  params,
  searchParams,
}: PageProps<'/regie/[code]/preparation'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const t = await getTranslations('regie.preparation');
  const tJeux = await getTranslations('jeux');
  const tEtiquettes = await getTranslations('admin.etiquettes');
  const code = evenement.code;
  const langue = evenement.langues[0] ?? 'fr';
  // « Tout afficher » lève le filtre du public, jamais celui des langues.
  const tout = (await searchParams)['tout'] === '1';

  const [
    { data: equipes },
    { data: manches },
    { data: banque },
    { data: joueurs },
    { data: photos },
    { data: groupes },
  ] = await Promise.all([
    supabase
      .from('equipes')
      .select('id, numero, nom')
      .eq('evenement_id', evenement.id)
      .order('numero'),
    supabase
      .from('manches')
      .select('id, jeu, ordre, statut, options, passages(id, ordre, statut, equipe_id, contenu_id)')
      .eq('evenement_id', evenement.id)
      .order('ordre'),
    supabase
      .from('contenus')
      .select(
        'id, jeu, etiquette, actif, contenus_traductions(langue, valeur), contenus_secrets(langue, valeur)',
      )
      .in('jeu', ['list2', 'enchere2', 'qcm2', 'mime2', 'photo2'])
      .order('cree_le'),
    supabase.from('joueurs').select('equipe_id').eq('evenement_id', evenement.id),
    supabase.from('photos').select('theme_id').eq('evenement_id', evenement.id),
    supabase.from('groupes').select('ordre, nom').eq('evenement_id', evenement.id),
  ]);
  const groupeDeRang = new Map((groupes ?? []).map((g) => [g.ordre, g.nom]));

  const nomEquipe = new Map((equipes ?? []).map((e) => [e.id, e]));
  const peuplees = new Set((joueurs ?? []).map((j) => j.equipe_id));
  // Un thème qui a déjà reçu des photos ne change plus : elles resteraient sans thème.
  const themesPhotographies = new Set((photos ?? []).map((p) => p.theme_id));
  // Les contenus actifs qui conviennent à la soirée (langues, public), plus celui déjà choisi
  // pour ce passage, quel qu'il soit : sinon le menu l'afficherait comme vide.
  const options = (jeu: string, choisi: string | null): OptionContenu[] =>
    (banque ?? [])
      .filter(
        (c) => c.jeu === jeu && (c.id === choisi || (c.actif && proposable(c, evenement, tout))),
      )
      .map((c) => ({
        id: c.id,
        libelle: libelleContenu(jeu, c.contenus_traductions, c.contenus_secrets, langue),
      }));

  const programme = (manches ?? []).map((m) => ({
    ...m,
    passages: [...(m.passages ?? [])].sort((a, b) => a.ordre - b.ordre),
    options: (m.options ?? {}) as Valeur,
  }));
  const duree = dureeProgramme(
    programme.map((m) =>
      elementDuProgramme({ jeu: m.jeu, options: m.options, passages: m.passages.length }),
    ),
    { creneauMin: evenement.creneau_minutes },
  );

  return (
    <>
      <h1 className="tu-regie__title">{t('titre')}</h1>

      <section className="tu-regie__section" aria-labelledby="equipes">
        <h2 id="equipes" className="tu-regie__section-title">
          {t('equipes')}
        </h2>
        <form action={renommerEquipes.bind(null, code)} className="tu-regie__section">
          <ul className="tu-regie-list">
            {(equipes ?? []).map((e) => (
              <li key={e.id} className="tu-regie-item">
                <TeamDot index={e.numero} name="" aria-hidden="true" />
                <label className="tu-field tu-regie-item__grow">
                  <span className="tu-visually-hidden">{t('nomEquipe', { numero: e.numero })}</span>
                  <input
                    className="tu-field__control"
                    name={`nom-${e.id}`}
                    defaultValue={e.nom}
                    maxLength={60}
                    required
                  />
                </label>
                {(equipes ?? []).length > 2 && !peuplees.has(e.id) && (
                  <Button
                    type="submit"
                    variant="ghost"
                    formAction={retirerEquipe.bind(null, code, e.id)}
                    formNoValidate
                  >
                    {t('retirer')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="tu-cluster">
            <Button type="submit">{t('enregistrerNoms')}</Button>
            {(equipes ?? []).length < 8 && (
              <Button
                type="submit"
                variant="ghost"
                formAction={ajouterEquipe.bind(null, code)}
                formNoValidate
              >
                {t('ajouterEquipe')}
              </Button>
            )}
          </div>
        </form>
      </section>

      <section className="tu-regie__section" aria-labelledby="groupes">
        <h2 id="groupes" className="tu-regie__section-title">
          {t('groupes.titre')}
        </h2>
        <p className="tu-regie__muted">{t('groupes.aide')}</p>
        <form action={enregistrerGroupes.bind(null, code)} className="tu-regie__section">
          <ul className="tu-regie-list">
            {Array.from({ length: MAX_GROUPES }, (_, i) => i + 1).map((ordre) => (
              <li key={ordre} className="tu-regie-item">
                <label className="tu-field tu-regie-item__grow">
                  <span className="tu-visually-hidden">{t('groupes.nom', { numero: ordre })}</span>
                  <input
                    className="tu-field__control"
                    name={`groupe-${ordre}`}
                    defaultValue={groupeDeRang.get(ordre) ?? ''}
                    placeholder={
                      ordre === 1 || ordre === 2
                        ? t(`groupes.exemple.${evenement.type_client}.${ordre}`)
                        : ''
                    }
                    maxLength={40}
                  />
                </label>
              </li>
            ))}
          </ul>
          <div className="tu-cluster">
            <Button type="submit">{t('groupes.enregistrer')}</Button>
          </div>
        </form>
      </section>

      <section className="tu-regie__section" aria-labelledby="programme">
        <h2 id="programme" className="tu-regie__section-title">
          {t('programme')}
        </h2>
        <p className="tu-regie__muted" data-testid="duree">
          {t('duree', {
            total: duree.totalMin,
            chronos: formatDuree(duree.chronosS),
            transitions: formatDuree(duree.transitionsS),
            creneau: evenement.creneau_minutes,
          })}
        </p>
        {duree.depassement && (
          <p className="tu-regie__alert" role="status">
            {t('depassement', { minutes: duree.depassement.ecartMin })}
          </p>
        )}
        <p className="tu-regie__muted" data-testid="filtre">
          {t(tout ? 'filtreLeve' : 'filtre', {
            etiquettes: etiquettesDe(evenement.type_client)
              .map((e) => tEtiquettes(e))
              .join(' + '),
            langues: evenement.langues.map((l) => l.toUpperCase()).join(', '),
          })}{' '}
          <Link
            href={tout ? `/regie/${code}/preparation` : `/regie/${code}/preparation?tout=1`}
            className="tu-regie__lien"
          >
            {tout ? t('filtrer') : t('toutAfficher')}
          </Link>
        </p>

        {programme.length === 0 ? (
          <p className="tu-regie__muted">{t('programmeVide')}</p>
        ) : (
          <ol className="tu-regie-list">
            {programme.map((m, i) => {
              const modifiable = m.statut === 'a_venir';
              const preparable = ['list2', 'enchere2', 'qcm2', 'mime2', 'photo2'].includes(m.jeu);
              // Un passage par équipe (Points communs, Mime), ou un par thème, par question.
              const parEquipe = m.jeu === 'list2' || m.jeu === 'mime2';
              return (
                <li key={m.id} className="tu-regie-item">
                  <div className="tu-regie-item__main">
                    <span className="tu-regie-item__title">
                      {i + 1}. {tJeux(m.jeu)}
                    </span>
                    <span className="tu-regie-item__meta">
                      {t(`statut.${m.statut}`)}
                      {m.jeu === 'enchere2' &&
                        ` · ${t('chrono', { secondes: Number(m.options['chrono_s'] ?? CHRONO_SURENCHERE_DEFAUT_S) })}`}
                    </span>
                    {preparable && (
                      <ul className="tu-regie-list">
                        {m.passages.map((p) => (
                          <li key={p.id} className="tu-regie-player">
                            <span className="tu-regie-player__name">
                              {parEquipe
                                ? (nomEquipe.get(p.equipe_id ?? '')?.nom ?? '—')
                                : m.jeu === 'qcm2'
                                  ? t('question', { numero: p.ordre })
                                  : t('theme', { numero: p.ordre })}
                            </span>
                            <SelectContenu
                              code={code}
                              passageId={p.id}
                              valeur={p.contenu_id}
                              options={options(m.jeu, p.contenu_id)}
                              desactive={
                                !modifiable ||
                                p.statut !== 'a_venir' ||
                                (p.contenu_id !== null && themesPhotographies.has(p.contenu_id))
                              }
                              libelle={t('contenu')}
                              aucun={t('aucunContenu')}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {modifiable && (
                    <form className="tu-regie-item__actions">
                      <Button
                        type="submit"
                        variant="ghost"
                        formAction={deplacerManche.bind(null, code, m.id, -1)}
                        disabled={i === 0}
                        aria-label={t('monter')}
                      >
                        ↑
                      </Button>
                      <Button
                        type="submit"
                        variant="ghost"
                        formAction={deplacerManche.bind(null, code, m.id, 1)}
                        disabled={i === programme.length - 1}
                        aria-label={t('descendre')}
                      >
                        ↓
                      </Button>
                      <Button
                        type="submit"
                        variant="ghost"
                        formAction={retirerManche.bind(null, code, m.id)}
                      >
                        {t('retirer')}
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="tu-regie__form">
          <form action={ajouterPointsCommuns.bind(null, code)} className="tu-regie-item">
            <label className="tu-field">
              <span className="tu-field__label">{t('tours')}</span>
              <input
                className="tu-field__control"
                name="tours"
                type="number"
                min={1}
                max={3}
                defaultValue={1}
              />
            </label>
            <Button type="submit">{t('ajouter', { jeu: tJeux('list2') })}</Button>
          </form>
          <form action={ajouterSurenchere.bind(null, code)} className="tu-regie-item">
            <label className="tu-field">
              <span className="tu-field__label">{t('themes')}</span>
              <input
                className="tu-field__control"
                name="themes"
                type="number"
                min={1}
                max={6}
                defaultValue={3}
              />
            </label>
            <label className="tu-field">
              <span className="tu-field__label">{t('chronoChamp')}</span>
              <input
                className="tu-field__control"
                name="chrono"
                type="number"
                min={10}
                max={300}
                step={5}
                defaultValue={CHRONO_SURENCHERE_DEFAUT_S}
              />
            </label>
            <Button type="submit">{t('ajouter', { jeu: tJeux('enchere2') })}</Button>
          </form>
          <form action={ajouterQuiz.bind(null, code)} className="tu-regie-item">
            <label className="tu-field">
              <span className="tu-field__label">{t('questions')}</span>
              <select
                className="tu-field__control"
                name="questions"
                defaultValue={QUESTIONS_QUIZ_DEFAUT}
              >
                {QUESTIONS_QUIZ.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">{t('ajouter', { jeu: tJeux('qcm2') })}</Button>
          </form>
          <form action={ajouterMime.bind(null, code)} className="tu-regie-item">
            <label className="tu-field">
              <span className="tu-field__label">{t('tours')}</span>
              <input
                className="tu-field__control"
                name="tours"
                type="number"
                min={1}
                max={3}
                defaultValue={1}
              />
            </label>
            <Button type="submit">{t('ajouter', { jeu: tJeux('mime2') })}</Button>
          </form>
          {!programme.some((m) => m.jeu === 'photo2' && m.statut !== 'annulee') && (
            <form action={ajouterPhoto.bind(null, code)} className="tu-regie-item">
              <label className="tu-field">
                <span className="tu-field__label">{t('themes')}</span>
                <input
                  className="tu-field__control"
                  name="themes"
                  type="number"
                  min={1}
                  max={6}
                  defaultValue={2}
                />
              </label>
              <Button type="submit">{t('ajouter', { jeu: tJeux('photo2') })}</Button>
            </form>
          )}
        </div>
      </section>

      <section className="tu-regie__section" aria-labelledby="beta">
        <h2 id="beta" className="tu-regie__section-title">
          {t('beta.titre')}
        </h2>
        <p className="tu-regie__muted">{t('beta.aide')}</p>
        {evenement.creneau_minutes < 60 && (
          <p className="tu-regie__alert" role="status">
            {t('beta.creneauCourt', { minutes: evenement.creneau_minutes })}
          </p>
        )}
        <div className="tu-regie__form">
          {/* Tête, épaule, gobelet d'abord : aucun matériel, aucun contenu (spec v3). */}
          {(['cup', 'grab'] as const).map((jeu) => (
            <form key={jeu} action={ajouterDuels.bind(null, code, jeu)} className="tu-regie-item">
              <label className="tu-field">
                <span className="tu-field__label">{t('beta.duels')}</span>
                <input
                  className="tu-field__control"
                  name="duels"
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={DUELS_DEFAUT}
                />
              </label>
              <Button type="submit" variant="ghost">
                {t('ajouter', { jeu: tJeux(jeu) })}
              </Button>
            </form>
          ))}
        </div>
      </section>
    </>
  );
}
