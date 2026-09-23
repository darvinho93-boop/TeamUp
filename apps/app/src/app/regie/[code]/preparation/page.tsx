import { getTranslations } from 'next-intl/server';
import { Button, TeamDot } from '@teamup/ui/react';
import { CHRONO_SURENCHERE_DEFAUT_S, dureeProgramme, formatDuree } from '@teamup/game';
import { elementDuProgramme } from '@/lib/programme';
import { evenementDeLaRegie } from '@/serveur/regie';
import { SelectContenu, type OptionContenu } from '@/regie/SelectContenu';
import {
  ajouterEquipe,
  ajouterPointsCommuns,
  ajouterSurenchere,
  deplacerManche,
  renommerEquipes,
  retirerEquipe,
  retirerManche,
} from './actions';

export async function generateMetadata() {
  return { title: (await getTranslations('regie.nav'))('preparation') };
}

type Valeur = Record<string, unknown>;
interface Traduite {
  langue: string;
  valeur: Valeur;
}

/** Ce que l'animateur reconnaît d'un contenu : la réponse, ou le thème et son sujet. */
function libelle(jeu: string, publics: Traduite[], secrets: Traduite[], langue: string): string {
  const dans = (liste: Traduite[]) =>
    (liste.find((l) => l.langue === langue) ?? liste.find((l) => l.langue === 'fr'))?.valeur ?? {};
  const texte = (v: Valeur, cle: string) => (typeof v[cle] === 'string' ? v[cle] : '—');
  const p = dans(publics);
  const s = dans(secrets);
  if (jeu === 'list2') return texte(s, 'reponse');
  if (jeu === 'enchere2') return `${texte(p, 'theme')} — ${texte(s, 'sujet')}`;
  return '—';
}

export default async function Preparation({ params }: PageProps<'/regie/[code]/preparation'>) {
  const { supabase, evenement } = await evenementDeLaRegie((await params).code);
  const t = await getTranslations('regie.preparation');
  const tJeux = await getTranslations('jeux');
  const code = evenement.code;
  const langue = evenement.langues[0] ?? 'fr';

  const [{ data: equipes }, { data: manches }, { data: banque }, { data: joueurs }] =
    await Promise.all([
      supabase
        .from('equipes')
        .select('id, numero, nom')
        .eq('evenement_id', evenement.id)
        .order('numero'),
      supabase
        .from('manches')
        .select(
          'id, jeu, ordre, statut, options, passages(id, ordre, statut, equipe_id, contenu_id)',
        )
        .eq('evenement_id', evenement.id)
        .order('ordre'),
      supabase
        .from('contenus')
        .select('id, jeu, contenus_traductions(langue, valeur), contenus_secrets(langue, valeur)')
        .in('jeu', ['list2', 'enchere2'])
        .eq('actif', true)
        .order('cree_le'),
      supabase.from('joueurs').select('equipe_id').eq('evenement_id', evenement.id),
    ]);

  const nomEquipe = new Map((equipes ?? []).map((e) => [e.id, e]));
  const peuplees = new Set((joueurs ?? []).map((j) => j.equipe_id));
  const options = (jeu: string): OptionContenu[] =>
    (banque ?? [])
      .filter((c) => c.jeu === jeu)
      .map((c) => ({
        id: c.id,
        libelle: libelle(
          jeu,
          c.contenus_traductions as Traduite[],
          c.contenus_secrets as Traduite[],
          langue,
        ),
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

        {programme.length === 0 ? (
          <p className="tu-regie__muted">{t('programmeVide')}</p>
        ) : (
          <ol className="tu-regie-list">
            {programme.map((m, i) => {
              const modifiable = m.statut === 'a_venir';
              const preparable = m.jeu === 'list2' || m.jeu === 'enchere2';
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
                              {m.jeu === 'list2'
                                ? (nomEquipe.get(p.equipe_id ?? '')?.nom ?? '—')
                                : t('theme', { numero: p.ordre })}
                            </span>
                            <SelectContenu
                              code={code}
                              passageId={p.id}
                              valeur={p.contenu_id}
                              options={options(m.jeu)}
                              desactive={!modifiable || p.statut !== 'a_venir'}
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
        </div>
      </section>
    </>
  );
}
