import { expect, test, type Page } from '@playwright/test';
import {
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from '../tests/base';

/**
 * Points communs d'une soirée en trois langues, trois indices donnés (2026-10-23) : chrono,
 * paliers, indices et verdict tiennent dans la scène en 1 920 × 1 080, le texte se réduisant au
 * besoin. Empilés, trois indices en trois langues sortaient de l'écran.
 */

const CONTENU = {
  fr: {
    consigne: 'Trouvez ce que ces personnes ont en commun',
    reponse: 'les personnes qui ont déjà dansé à un mariage',
    indices: [
      'Cela se passe souvent tard le soir, après le repas et les discours',
      'Il y a de la musique, souvent très fort, et une piste au milieu de la salle',
      'Les mariés ouvrent le bal, puis tout le monde les rejoint',
    ],
  },
  en: {
    consigne: 'Find what these people have in common',
    reponse: 'people who have already danced at a wedding',
    indices: [
      'It often happens late in the evening, after dinner and the speeches',
      'There is music, often very loud, and a floor in the middle of the room',
      'The newlyweds open the dance, then everyone joins them',
    ],
  },
  ta: {
    consigne: 'இவர்களுக்குள் உள்ள பொதுவான அம்சத்தைக் கண்டுபிடியுங்கள்',
    reponse: 'திருமணத்தில் ஏற்கனவே நடனமாடியவர்கள்',
    indices: [
      'இது பெரும்பாலும் இரவு உணவு மற்றும் உரைகளுக்குப் பிறகு தாமதமாக நடக்கும்',
      'இசை இருக்கும், பெரும்பாலும் மிகவும் சத்தமாக, அறையின் நடுவில் ஒரு மேடை',
      'மணமக்கள் நடனத்தைத் தொடங்குவார்கள், பிறகு அனைவரும் சேர்ந்துகொள்வார்கள்',
    ],
  },
} as const;

let evenement: { id: string; code: string };
let contenu: string | null = null;

test.afterAll(async () => {
  await supprimerEvenements([evenement.id]);
  if (contenu) await clientService().from('contenus').delete().eq('id', contenu);
});

/** Ce qui sort de la scène ou du bloc du jeu, en pixels (vide si tout tient), comme l'écran. */
async function debords(ecran: Page): Promise<number[]> {
  return ecran.locator('.tu-stage__body, .tu-stage-jeu').evaluateAll((blocs) =>
    blocs
      .map((b) => {
        const cadre = b.getBoundingClientRect();
        const boites = [...b.querySelectorAll('*')]
          .filter((e) => !e.closest('.tu-celebration'))
          .map((e) => e.getBoundingClientRect());
        return Math.max(
          0,
          ...boites.map((r) => r.bottom - cadre.bottom),
          ...boites.map((r) => cadre.top - r.top),
          ...boites.map((r) => r.right - cadre.right),
        );
      })
      .filter((ecart) => ecart > 1),
  );
}

test('trois indices en trois langues tiennent dans la scène', async ({ browser }) => {
  test.setTimeout(120_000);
  evenement = await creerEvenementJetable({ equipes: 4, langues: ['fr', 'en', 'ta'] });
  const service = clientService();
  const { data: c } = await service
    .from('contenus')
    .insert({ jeu: 'list2', etiquette: 'tout_public', actif: false })
    .select('id')
    .single();
  contenu = c!['id'] as string;
  await service.from('contenus_traductions').insert(
    Object.entries(CONTENU).map(([langue, v]) => ({
      contenu_id: contenu,
      langue,
      valeur: { consigne: v.consigne },
    })),
  );
  await service.from('contenus_secrets').insert(
    Object.entries(CONTENU).map(([langue, v]) => ({
      contenu_id: contenu,
      langue,
      valeur: { reponse: v.reponse, indices: v.indices },
    })),
  );
  const { data: equipe } = await service
    .from('equipes')
    .select('id')
    .eq('evenement_id', evenement.id)
    .eq('numero', 1)
    .single();
  const { data: m } = await service
    .from('manches')
    .insert({ evenement_id: evenement.id, jeu: 'list2', ordre: 1 })
    .select('id')
    .single();
  const manche = m!['id'] as string;
  const { data: p } = await service
    .from('passages')
    .insert({
      manche_id: manche,
      evenement_id: evenement.id,
      ordre: 1,
      contenu_id: contenu,
      equipe_id: equipe!['id'] as string,
    })
    .select('id')
    .single();
  const passage = p!['id'] as string;

  const anna = await clientAnimateur('anna@teamup.test');
  const etape = async (pilotage: object, extra: object = {}) => {
    const { data } = await appeler<{ pilotage: { version: string } }>(anna, 'etat_ecran', {
      p_code: evenement.code,
    });
    const { erreur } = await appeler(anna, 'enregistrer_etape', {
      p_evenement: evenement.id,
      p_version: data!.pilotage.version,
      p_pilotage: { scene: 'jeu', manche_id: manche, passage_id: passage, ...pilotage },
      ...extra,
    });
    expect(erreur).toBeNull();
  };

  const regie = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false })
  ).newPage();
  await regie.goto('/regie');
  await regie.getByLabel('E-mail').fill('anna@teamup.test');
  await regie.getByLabel('Mot de passe').fill('motdepasse');
  await regie.getByRole('button', { name: 'Se connecter' }).click();
  await regie.waitForURL('**/regie');
  const ecran = await (
    await browser.newContext({
      storageState: await regie.context().storageState(),
      viewport: { width: 1920, height: 1080 },
      isMobile: false,
    })
  ).newPage();
  const verifier = async (nom: string) => {
    await ecran.goto(`/ecran/${evenement.code}`);
    await expect(ecran.locator(`[data-scene="list2"][data-etape="${nom}"]`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(ecran.getByTestId('indices').locator('.tu-stage-indice')).toHaveCount(3);
    await expect.poll(() => debords(ecran), { message: `débords (${nom})` }).toEqual([]);
    await expect(ecran.getByRole('timer')).toBeInViewport({ ratio: 1 });
    await ecran.screenshot({ path: test.info().outputPath(`points-communs-${nom}.png`) });
  };

  // Chrono lancé, les trois indices donnés.
  await etape(
    { etape: 'lance', indices: 3, chrono: 'demarrer', chrono_duree_s: 130 },
    {
      p_manche: { id: manche, statut: 'en_cours' },
      p_passage: { id: passage, statut: 'en_cours' },
    },
  );
  await verifier('lance');

  // Trouvé : le verdict s'ajoute sous les indices.
  await service
    .from('passages')
    .update({ statut: 'termine', points: 120, resultat: { ecoule_ms: 100_000 } })
    .eq('id', passage);
  await etape({ etape: 'trouve', indices: 3, chrono: 'arreter' });
  await verifier('trouve');
  await expect(ecran.getByTestId('verdict')).toBeInViewport({ ratio: 1 });
});
