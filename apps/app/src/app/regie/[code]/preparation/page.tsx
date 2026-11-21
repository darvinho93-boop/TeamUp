import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button, cx } from '@teamup/ui/react';
import {
  bornerGobelets,
  GOBELETS_DEFAUT,
  GOBELETS_MAX,
  GOBELETS_MIN,
  CHRONO_CINEMIME_DEFAUT_S,
  CHRONO_CINEMIME_MAX_S,
  CHRONO_CINEMIME_MIN_S,
  chronoCinemimeS,
  CHRONO_SURENCHERE_DEFAUT_S,
  CHRONO_SURENCHERE_TELEPHONES_DEFAUT_S,
  DUELS_DEFAUT,
  EXTRAIT_BLIND_DEFAUT_S,
  EXTRAIT_BLIND_MAX_S,
  EXTRAIT_BLIND_MIN_S,
  TITRES_BLIND_DEFAUT,
  TITRES_BLIND_MAX,
  TITRES_BLIND_MIN,
  dureeProgramme,
  formatDuree,
  QUESTIONS_QUIZ,
  QUESTIONS_QUIZ_DEFAUT,
  CHRONO_TOUR_PORTRAIT_DEFAUT_S,
  CHRONO_TOUR_PORTRAIT_MAX_S,
  CHRONO_TOUR_PORTRAIT_MIN_S,
  CIBLES_PORTRAIT_DEFAUT,
  CIBLES_PORTRAIT_MAX,
  CIBLES_PORTRAIT_MIN,
  repereCarte,
} from '@teamup/game';
import { etiquettesDe, libelleContenu, proposable } from '@/lib/contenus';
import { MAX_GROUPES } from '@/lib/groupes';
import { estCheminFond } from '@/lib/fonds';
import { musiquesDe } from '@/lib/musiques';
import { extraitBlind, jeuParEquipe, titresBlind } from '@/lib/pilotage';
import { urlLogo } from '@/lib/logo';
import { elementDuProgramme } from '@/lib/programme';
import { estTournoi } from '@/lib/tournoi';
import { evenementDeLaRegie } from '@/serveur/regie';
import { FondDuJeu } from '@/regie/FondDuJeu';
import { FormulaireProche } from '@/regie/FormulaireProche';
import { chronoTourPortrait } from '@/lib/portrait';
import { LogoPartenaire } from '@/regie/LogoPartenaire';
import { SelectContenu, type OptionContenu } from '@/regie/SelectContenu';
import {
  ajouterBlind,
  ajouterDuels,
  ajusterReserve,
  ajouterMime,
  ajouterCinemime,
  ajouterPhoto,
  ajouterPointsCommuns,
  ajouterPortrait,
  ajouterQuiz,
  ajouterSurenchere,
  choisirContenuReserve,
  choisirNoirePortrait,
  choisirTitreBlind,
  deplacerManche,
  enregistrerCarte,
  enregistrerEquipesPrevues,
  enregistrerGroupes,
  enregistrerMusiques,
  melangerGrillePortrait,
  refaireGrillePortrait,
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
    { data: photos },
    { data: groupes },
    { data: reglageGroupes },
    { data: reglageLogo },
    { data: bibliotheque },
    { data: lignesFonds },
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
        'id, jeu, etiquette, actif, evenement_id, contenus_traductions(langue, valeur), contenus_secrets(langue, valeur)',
      )
      .in('jeu', ['list2', 'enchere2', 'qcm2', 'mime2', 'photo2', 'portrait', 'cinemime'])
      .or(`evenement_id.is.null,evenement_id.eq.${evenement.id}`)
      .order('cree_le'),
    supabase.from('photos').select('theme_id').eq('evenement_id', evenement.id),
    supabase.from('groupes').select('ordre, nom').eq('evenement_id', evenement.id),
    supabase
      .from('evenements')
      .select('groupe_facultatif, carte_visible, titre_public')
      .eq('id', evenement.id)
      .maybeSingle(),
    // À part : sans la migration 20261111090000, seule cette lecture échoue (aucun logo).
    supabase.from('evenements').select('logo_partenaire').eq('id', evenement.id).maybeSingle(),
    // Les musiques sous les chronos (2026-11-15) ; sans la migration, aucune.
    supabase.from('musiques').select('id, titre, artiste, actif').order('titre'),
    // Les photos de fond des jeux (2026-11-15) ; à part : sans la migration 20261117090000, seule
    // cette lecture échoue (aucune photo).
    supabase.from('manches').select('id, fond').eq('evenement_id', evenement.id),
  ]);
  // Leur aperçu : des URL signées (bucket privé), le temps de la page.
  const fonds = (lignesFonds ?? []).flatMap((l) =>
    estCheminFond(l.fond) ? [{ manche: l.id, chemin: l.fond }] : [],
  );
  const { data: signees } = fonds.length
    ? await supabase.storage.from('fonds').createSignedUrls(
        fonds.map((f) => f.chemin),
        3600,
      )
    : { data: [] };
  const urlFond = new Map(
    fonds.flatMap((f, i) => {
      const url = signees?.[i]?.signedUrl;
      return url ? [[f.manche, url] as const] : [];
    }),
  );
  const musiques = bibliotheque ?? [];
  // Portrait mystère (2026-11-18) : les grilles, les noms des portraits, les proches de la soirée.
  const manchesPortrait = (manches ?? []).filter((m) => m.jeu === 'portrait').map((m) => m.id);
  const { data: lignesGrilles } = manchesPortrait.length
    ? await supabase
        .from('grilles_portrait')
        .select('manche_id, cartes, noire')
        .in('manche_id', manchesPortrait)
    : { data: [] };
  const grilles = new Map((lignesGrilles ?? []).map((g) => [g.manche_id, g]));
  const portraits = (banque ?? []).filter((c) => c.jeu === 'portrait');
  const nomPortrait = new Map(
    portraits.map((c) => [
      c.id,
      libelleContenu('portrait', c.contenus_traductions, c.contenus_secrets, langue),
    ]),
  );
  const proches = portraits
    .filter((c) => c.evenement_id === evenement.id && c.actif)
    .map((c) => nomPortrait.get(c.id) ?? '—');
  const portraitsDisponibles = portraits.filter(
    (c) => c.actif && proposable(c, evenement, tout),
  ).length;
  // Sans la migration 20261022100000, la lecture échoue : proposé, comme avant.
  const groupeFacultatif = reglageGroupes?.groupe_facultatif ?? true;
  const groupeDeRang = new Map((groupes ?? []).map((g) => [g.ordre, g.nom]));

  const nomEquipe = new Map((equipes ?? []).map((e) => [e.id, e]));
  const reserveDe = (options: Valeur): string[] =>
    Array.isArray(options['reserve'])
      ? (options['reserve'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];
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
  // Audit du 2026-11-02 : une question ou un thème sans contenu ne se voyait qu'en soirée, sur
  // l'écran (la banque en ligne n'avait aucun thème photo). La préparation le dit.
  const sansContenu =
    programme
      .filter(
        (m) => m.statut === 'a_venir' && ['enchere2', 'qcm2', 'photo2', 'portrait'].includes(m.jeu),
      )
      .reduce((n, m) => n + m.passages.filter((p) => p.contenu_id === null).length, 0) +
    programme
      .filter((m) => m.statut === 'a_venir' && m.jeu === 'blind')
      .reduce((n, m) => n + titresBlind(m).filter((x) => x.musique === null).length, 0);
  // Le tournoi du gobelet se chiffre sur les invités annoncés, à défaut sur les inscrits.
  const [{ data: attendus }, { count: inscrits }] = await Promise.all([
    supabase.from('evenements').select('invites_attendus').eq('id', evenement.id).maybeSingle(),
    supabase
      .from('joueurs')
      .select('id', { count: 'exact', head: true })
      .eq('evenement_id', evenement.id),
  ]);
  const joueursPrevus = attendus?.invites_attendus ?? inscrits ?? 0;
  const duree = dureeProgramme(
    programme.map((m) =>
      elementDuProgramme({
        jeu: m.jeu,
        options: m.options,
        joueursPrevus,
        // Lot 14 : avant la formation, une manche par équipe n'a pas encore ses passages.
        passages:
          m.passages.length > 0 || !jeuParEquipe(m.jeu)
            ? m.passages.length
            : evenement.equipes_prevues * Number(m.options['passages_par_equipe'] ?? 1),
      }),
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
        <p className="tu-regie__muted" data-testid="etat-equipes">
          {(equipes ?? []).length > 0
            ? t('equipesFormees', { n: (equipes ?? []).length })
            : t('equipesAFormer')}{' '}
          <Link href={`/regie/${code}/salle`} className="tu-regie__lien">
            {t('versSalle')}
          </Link>
        </p>
        <form action={enregistrerEquipesPrevues.bind(null, code)} className="tu-regie-item">
          <label className="tu-field">
            <span className="tu-field__label">{t('equipesPrevues')}</span>
            <input
              className="tu-field__control"
              name="equipes_prevues"
              type="number"
              min={2}
              max={8}
              defaultValue={evenement.equipes_prevues}
              required
            />
          </label>
          <Button type="submit">{t('enregistrer')}</Button>
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
          <label className="tu-regie__choices">
            <input type="checkbox" name="groupe_facultatif" defaultChecked={groupeFacultatif} />
            {t('groupes.facultatif')}
          </label>
          <div className="tu-cluster">
            <Button type="submit">{t('groupes.enregistrer')}</Button>
          </div>
        </form>
      </section>

      <section className="tu-regie__section" aria-labelledby="carte">
        <h2 id="carte" className="tu-regie__section-title">
          {t('carte.titre')}
        </h2>
        <p className="tu-regie__muted">{t('carte.aide')}</p>
        <form action={enregistrerCarte.bind(null, code)} className="tu-regie__section">
          <label className="tu-field">
            <span className="tu-field__label">{t('carte.titrePublic')}</span>
            <input
              className="tu-field__control"
              name="titre_public"
              defaultValue={reglageGroupes?.titre_public ?? ''}
              placeholder={t(`carte.exemple.${evenement.type_client}`)}
              maxLength={60}
            />
          </label>
          <label className="tu-regie__choices">
            <input
              type="checkbox"
              name="carte_visible"
              defaultChecked={reglageGroupes?.carte_visible ?? false}
            />
            {t('carte.visible')}
          </label>
          <p className="tu-regie__muted" data-testid="carte-statut">
            {reglageGroupes?.carte_visible ? t('carte.statutVisible') : t('carte.statutCachee')}
          </p>
          <div className="tu-cluster">
            <Button type="submit">{t('carte.enregistrer')}</Button>
          </div>
        </form>
      </section>

      <section className="tu-regie__section" aria-labelledby="partenaire">
        <h2 id="partenaire" className="tu-regie__section-title">
          {t('partenaire.titre')}
        </h2>
        <p className="tu-regie__muted">{t('partenaire.aide')}</p>
        <LogoPartenaire code={code} actuel={urlLogo(reglageLogo?.logo_partenaire)} />
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
        {sansContenu > 0 && (
          <p className="tu-regie__alert" role="status" data-testid="sans-contenu">
            {t('sansContenu', { n: sansContenu })}
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
              const preparable = [
                'list2',
                'enchere2',
                'qcm2',
                'mime2',
                'photo2',
                'portrait',
                'cinemime',
              ].includes(m.jeu);
              // Un passage par équipe (Points communs, Mime, Ciné-mime), ou un par thème, par question.
              const parEquipe = jeuParEquipe(m.jeu);
              return (
                <li key={m.id} className="tu-regie-item tu-regie-item--manche">
                  <div className="tu-regie-item__main tu-regie-item__grow">
                    <span className="tu-regie-item__title">
                      {i + 1}. {tJeux(m.jeu)}
                    </span>
                    <span className="tu-regie-item__meta">
                      {t(`statut.${m.statut}`)}
                      {estTournoi(m) &&
                        ` · ${t('beta.metaTournoi', { gobelets: bornerGobelets(m.options['gobelets']) })}`}
                      {m.jeu === 'blind' &&
                        ` · ${t('blind.extrait', { secondes: extraitBlind(m) })}`}
                      {m.jeu === 'portrait' &&
                        ` · ${t('portrait.meta', { cibles: m.passages.length, secondes: chronoTourPortrait(m) })}`}
                      {m.jeu === 'cinemime' &&
                        ` · ${t('chrono', { secondes: chronoCinemimeS(m.options['chrono_s']) })}`}
                      {m.jeu === 'enchere2' &&
                        ` · ${t('chrono', { secondes: Number(m.options['chrono_s'] ?? CHRONO_SURENCHERE_DEFAUT_S) })} · ${t('chronoTelephones', { secondes: Number(m.options['chrono_telephones_s'] ?? CHRONO_SURENCHERE_TELEPHONES_DEFAUT_S) })}`}
                    </span>
                    {m.statut !== 'annulee' && (
                      <FondDuJeu
                        code={code}
                        manche={m.id}
                        ordre={m.ordre}
                        actuel={urlFond.get(m.id) ?? null}
                      />
                    )}
                    {parEquipe &&
                      (m.options['reserve'] !== undefined || m.passages.length === 0) && (
                        <div className="tu-regie__section" data-testid={`reserve-${m.jeu}`}>
                          <p className="tu-regie__muted">
                            {t('reserve.titre', {
                              n: reserveDe(m.options).length,
                              besoin:
                                ((equipes ?? []).length || evenement.equipes_prevues) *
                                Number(m.options['passages_par_equipe'] ?? 1),
                            })}
                          </p>
                          <ul className="tu-regie-list">
                            {reserveDe(m.options).map((contenu, index) => (
                              <li key={contenu} className="tu-regie-passage">
                                <span className="tu-regie-passage__nom">
                                  {t('reserve.ligne', { numero: index + 1 })}
                                </span>
                                <SelectContenu
                                  code={code}
                                  enregistrer={choisirContenuReserve.bind(null, code, m.id, index)}
                                  valeur={contenu}
                                  options={options(m.jeu, contenu)}
                                  desactive={!modifiable}
                                  libelle={t('contenu')}
                                  aucun={t('reserve.retirerLigne')}
                                />
                              </li>
                            ))}
                          </ul>
                          {modifiable && (
                            <form className="tu-cluster">
                              <Button
                                type="submit"
                                variant="ghost"
                                formAction={ajusterReserve.bind(null, code, m.id, m.jeu, 1)}
                              >
                                {t('reserve.ajouter')}
                              </Button>
                            </form>
                          )}
                        </div>
                      )}
                    {(m.jeu === 'qcm2' || m.jeu === 'enchere2') &&
                      (modifiable || musiquesDe(m.options).length > 0) && (
                        // Les musiques actives, plus celles déjà cochées et désactivées depuis
                        // (elles ne joueront pas, mais se décochent ici).
                        <form
                          action={enregistrerMusiques.bind(null, code, m.id)}
                          className="tu-regie__section"
                          data-testid={`musiques-${m.ordre}`}
                        >
                          <p className="tu-regie__muted">
                            {musiques.some((x) => x.actif) ? t('musique.aide') : t('musique.vide')}
                          </p>
                          <fieldset className="tu-regie__choices" disabled={!modifiable}>
                            <legend className="tu-visually-hidden">{t('musique.titre')}</legend>
                            {musiques
                              .filter((x) => x.actif || musiquesDe(m.options).includes(x.id))
                              .map((x) => (
                                <label key={x.id}>
                                  <input
                                    type="checkbox"
                                    name="musique"
                                    value={x.id}
                                    defaultChecked={musiquesDe(m.options).includes(x.id)}
                                  />
                                  {x.actif ? x.titre : t('musique.inactive', { titre: x.titre })}
                                </label>
                              ))}
                          </fieldset>
                          {modifiable && musiques.some((x) => x.actif) && (
                            <div className="tu-cluster">
                              <Button type="submit" variant="ghost">
                                {t('musique.enregistrer')}
                              </Button>
                            </div>
                          )}
                        </form>
                      )}
                    {m.jeu === 'blind' && (
                      <ul
                        className="tu-regie-list tu-regie-titres"
                        data-testid={`titres-${m.ordre}`}
                      >
                        {titresBlind(m).map((titre, index) => (
                          <li key={index}>
                            <form
                              action={choisirTitreBlind.bind(null, code, m.id, index)}
                              className="tu-regie-titre-blind"
                            >
                              <span className="tu-regie-passage__nom">
                                {t('blind.titre', { numero: index + 1 })}
                              </span>
                              <label className="tu-field tu-regie-item__grow">
                                <span className="tu-visually-hidden">
                                  {t('blind.titre', { numero: index + 1 })}
                                </span>
                                <select
                                  className="tu-field__control"
                                  name="musique"
                                  defaultValue={titre.musique ?? ''}
                                  disabled={!modifiable}
                                >
                                  <option value="">{t('blind.aChoisir')}</option>
                                  {musiques
                                    .filter((x) => x.actif || x.id === titre.musique)
                                    .map((x) => (
                                      <option key={x.id} value={x.id}>
                                        {x.artiste ? `${x.titre} — ${x.artiste}` : x.titre}
                                      </option>
                                    ))}
                                </select>
                              </label>
                              <label className="tu-field tu-regie-titre-blind__debut">
                                <span className="tu-visually-hidden">
                                  {t('blind.debutDe', { numero: index + 1 })}
                                </span>
                                <input
                                  className="tu-field__control"
                                  name="debut"
                                  type="number"
                                  min={0}
                                  max={3600}
                                  defaultValue={titre.debutS}
                                  placeholder={t('blind.debut')}
                                  disabled={!modifiable}
                                />
                              </label>
                              {modifiable && (
                                <Button type="submit" variant="ghost">
                                  {t('blind.enregistrer')}
                                </Button>
                              )}
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                    {preparable && m.passages.length > 0 && (
                      <ul className="tu-regie-list">
                        {m.passages.map((p) => (
                          <li key={p.id} className="tu-regie-passage">
                            <span className="tu-regie-passage__nom">
                              {parEquipe
                                ? (nomEquipe.get(p.equipe_id ?? '')?.nom ?? '—')
                                : m.jeu === 'qcm2'
                                  ? t('question', { numero: p.ordre })
                                  : m.jeu === 'portrait'
                                    ? t('portrait.cible', { numero: p.ordre })
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
                    {m.jeu === 'portrait' &&
                      (() => {
                        const grille = grilles.get(m.id);
                        const cibles = m.passages.flatMap((p) =>
                          p.contenu_id ? [p.contenu_id] : [],
                        );
                        const noire = grille ? grille.cartes[grille.noire] : undefined;
                        const prete =
                          grille !== undefined &&
                          cibles.length === m.passages.length &&
                          cibles.every((c) => grille.cartes.includes(c)) &&
                          noire !== undefined &&
                          !cibles.includes(noire);
                        return (
                          <div className="tu-regie__section" data-testid={`grille-${m.ordre}`}>
                            <p
                              className={prete ? 'tu-regie__muted' : 'tu-regie__alert'}
                              role="status"
                            >
                              {prete
                                ? t('portrait.grillePrete')
                                : t('portrait.grilleManque', { n: portraitsDisponibles })}
                            </p>
                            <div className="tu-regie-passage">
                              <span className="tu-regie-passage__nom">{t('portrait.noire')}</span>
                              <SelectContenu
                                code={code}
                                enregistrer={choisirNoirePortrait.bind(null, code, m.id)}
                                valeur={noire ?? null}
                                options={options('portrait', noire ?? null).filter(
                                  (o) => !cibles.includes(o.id),
                                )}
                                desactive={!modifiable}
                                libelle={t('portrait.noire')}
                                aucun={t('portrait.noireAuHasard')}
                              />
                            </div>
                            {grille && (
                              <ol className="tu-regie-grille" aria-label={t('portrait.grille')}>
                                {grille.cartes.map((id, position) => {
                                  const rang = cibles.indexOf(id);
                                  const role =
                                    position === grille.noire
                                      ? 'noire'
                                      : rang >= 0
                                        ? 'cible'
                                        : 'leurre';
                                  return (
                                    <li
                                      key={id}
                                      className={cx(
                                        'tu-regie-grille__carte',
                                        `tu-regie-grille__carte--${role}`,
                                      )}
                                    >
                                      <span className="tu-regie-grille__repere">
                                        {repereCarte(position)}
                                      </span>
                                      <span>{nomPortrait.get(id) ?? '—'}</span>
                                      {role !== 'leurre' && (
                                        <span className="tu-regie-grille__role">
                                          {role === 'noire'
                                            ? t('portrait.noireCourt')
                                            : t('portrait.cibleCourt', { numero: rang + 1 })}
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            )}
                            {modifiable && (
                              <form className="tu-cluster">
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  formAction={refaireGrillePortrait.bind(null, code, m.id)}
                                >
                                  {t('portrait.refaire')}
                                </Button>
                                {grille && (
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    formAction={melangerGrillePortrait.bind(null, code, m.id)}
                                  >
                                    {t('portrait.melanger')}
                                  </Button>
                                )}
                              </form>
                            )}
                            {modifiable && (
                              <FormulaireProche
                                code={code}
                                langues={evenement.langues}
                                proches={proches}
                              />
                            )}
                          </div>
                        );
                      })()}
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
            <label className="tu-field">
              <span className="tu-field__label">{t('reserve.taille')}</span>
              <input
                className="tu-field__control"
                name="reserve"
                type="number"
                min={1}
                max={24}
                defaultValue={evenement.equipes_prevues}
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
            <label className="tu-field">
              <span className="tu-field__label">{t('chronoTelephonesChamp')}</span>
              <input
                className="tu-field__control"
                name="chrono_telephones"
                type="number"
                min={10}
                max={300}
                step={5}
                defaultValue={CHRONO_SURENCHERE_TELEPHONES_DEFAUT_S}
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
          <form action={ajouterBlind.bind(null, code)} className="tu-regie-item">
            <label className="tu-field">
              <span className="tu-field__label">{t('blind.titres')}</span>
              <input
                className="tu-field__control"
                name="titres"
                type="number"
                min={TITRES_BLIND_MIN}
                max={TITRES_BLIND_MAX}
                defaultValue={TITRES_BLIND_DEFAUT}
              />
            </label>
            <label className="tu-field">
              <span className="tu-field__label">{t('blind.extraitChamp')}</span>
              <input
                className="tu-field__control"
                name="extrait"
                type="number"
                min={EXTRAIT_BLIND_MIN_S}
                max={EXTRAIT_BLIND_MAX_S}
                defaultValue={EXTRAIT_BLIND_DEFAUT_S}
              />
            </label>
            <Button type="submit">{t('ajouter', { jeu: tJeux('blind') })}</Button>
          </form>
          <form action={ajouterPortrait.bind(null, code)} className="tu-regie-item">
            <label className="tu-field">
              <span className="tu-field__label">{t('portrait.cibles')}</span>
              <input
                className="tu-field__control"
                name="cibles"
                type="number"
                min={CIBLES_PORTRAIT_MIN}
                max={CIBLES_PORTRAIT_MAX}
                defaultValue={CIBLES_PORTRAIT_DEFAUT}
              />
            </label>
            <label className="tu-field">
              <span className="tu-field__label">{t('portrait.chronoChamp')}</span>
              <input
                className="tu-field__control"
                name="chrono"
                type="number"
                min={CHRONO_TOUR_PORTRAIT_MIN_S}
                max={CHRONO_TOUR_PORTRAIT_MAX_S}
                step={5}
                defaultValue={CHRONO_TOUR_PORTRAIT_DEFAUT_S}
              />
            </label>
            <Button type="submit">{t('ajouter', { jeu: tJeux('portrait') })}</Button>
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
            <label className="tu-field">
              <span className="tu-field__label">{t('reserve.taille')}</span>
              <input
                className="tu-field__control"
                name="reserve"
                type="number"
                min={1}
                max={24}
                defaultValue={evenement.equipes_prevues}
              />
            </label>
            <Button type="submit">{t('ajouter', { jeu: tJeux('mime2') })}</Button>
          </form>
          {/* Ciné-mime (2026-11-20) : une scène de film par équipe, un chrono pour la chaîne. */}
          <form action={ajouterCinemime.bind(null, code)} className="tu-regie-item">
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
            <label className="tu-field">
              <span className="tu-field__label">{t('reserve.taille')}</span>
              <input
                className="tu-field__control"
                name="reserve"
                type="number"
                min={1}
                max={24}
                defaultValue={evenement.equipes_prevues}
              />
            </label>
            <label className="tu-field">
              <span className="tu-field__label">{t('cinemime.chronoChamp')}</span>
              <input
                className="tu-field__control"
                name="chrono"
                type="number"
                min={CHRONO_CINEMIME_MIN_S}
                max={CHRONO_CINEMIME_MAX_S}
                step={15}
                defaultValue={CHRONO_CINEMIME_DEFAUT_S}
              />
            </label>
            <Button type="submit">{t('ajouter', { jeu: tJeux('cinemime') })}</Button>
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
              {/* Le gobelet se joue en tournoi par défaut (2026-11-21). */}
              {jeu === 'cup' && (
                <>
                  <label className="tu-field">
                    <span className="tu-field__label">{t('beta.format')}</span>
                    <select className="tu-field__control" name="format" defaultValue="tournoi">
                      <option value="tournoi">{t('beta.tournoi')}</option>
                      <option value="duels">{t('beta.duelsSimples')}</option>
                    </select>
                  </label>
                  <label className="tu-field">
                    <span className="tu-field__label">{t('beta.gobelets')}</span>
                    <input
                      className="tu-field__control"
                      name="gobelets"
                      type="number"
                      min={GOBELETS_MIN}
                      max={GOBELETS_MAX}
                      defaultValue={GOBELETS_DEFAUT}
                    />
                  </label>
                </>
              )}
              <label className="tu-field">
                <span className="tu-field__label">
                  {jeu === 'cup' ? t('beta.duelsSiSimples') : t('beta.duels')}
                </span>
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
