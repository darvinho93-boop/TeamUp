import { expect, test, type Page } from '@playwright/test';
import {
  appeler,
  clientAnimateur,
  clientService,
  creerEvenementJetable,
  supprimerEvenements,
} from '../tests/base';

/**
 * La Surenchère d'une soirée en trois langues (vu le 2026-10-18 avec un mariage) : six thèmes
 * aux sujets longs, dont un mot très long. Ni la grille des thèmes joués, ni l'écran du sujet
 * (chrono, verdict) ne sortent de la scène en 1 920 × 1 080 : le texte se réduit jusqu'à tenir.
 */

const THEMES: Record<'fr' | 'en' | 'ta', [string, string]>[] = [
  {
    fr: ['Cinéma', "Films d'un acteur célèbre de plus de quarante ans de carrière"],
    en: ['Cinema', 'Films by a famous actor with a career of over forty years'],
    ta: ['திரைப்படம்', 'நாற்பது ஆண்டுகளுக்கும் மேலான புகழ்பெற்ற நடிகரின் திரைப்படங்கள்'],
  },
  {
    fr: ['Maquillage', 'Produits de maquillage pour les yeux'],
    en: ['Make-up', 'Eye make-up products'],
    ta: ['ஒப்பனை', 'கண்களுக்கான ஒப்பனைப் பொருட்கள்'],
  },
  {
    fr: ['Géographie', 'Pays d’Afrique'],
    en: ['Geography', 'African countries'],
    ta: ['புவியியல்', 'ஆப்பிரிக்க நாடுகள்'],
  },
  {
    fr: ['Boissons', 'Alcools forts à 40 % ou plus'],
    en: ['Drinks', 'Spirits at 40% or more'],
    ta: ['பானங்கள்', '40% அல்லது அதற்கு மேல் உள்ள கடும் மதுபானங்கள்'],
  },
  {
    fr: ['Musique', 'Chansons de S. P. Balasubrahmanyam'],
    en: ['Music', 'Songs by S. P. Balasubrahmanyam'],
    ta: ['இசை', 'எஸ். பி. பாலசுப்ரமணியம் பாடிய பாடல்கள்'],
  },
  {
    fr: ['Gastronomie', 'Noms d’épices'],
    en: ['Food', 'Names of spices'],
    ta: ['சமையல்', 'மசாலாப் பொருட்களின் பெயர்கள்'],
  },
];

let evenement: { id: string; code: string };
const contenus: string[] = [];

test.afterAll(async () => {
  await supprimerEvenements([evenement.id]);
  if (contenus.length) await clientService().from('contenus').delete().in('id', contenus);
});

/**
 * Ce qui sort de la scène ou d'une carte, en pixels (vide si tout tient) : les boîtes des
 * éléments, par le bas et par la droite (un mot trop long), comme les mesure l'écran. Le dessin
 * des lettres qui dépasse de sa ligne (chiffres géants) ne compte pas.
 */
async function debords(ecran: Page): Promise<number[]> {
  return ecran.locator('.tu-stage__body, .tu-stage-theme').evaluateAll((blocs) =>
    blocs
      .map((b) => {
        const cadre = b.getBoundingClientRect();
        const boites = [...b.querySelectorAll('*')].map((e) => e.getBoundingClientRect());
        return Math.max(
          0,
          ...boites.map((r) => r.bottom - cadre.bottom),
          ...boites.map((r) => r.right - cadre.right),
          b.scrollWidth - b.clientWidth,
        );
      })
      .filter((ecart) => ecart > 1),
  );
}

test('les thèmes et les sujets tiennent dans la scène, en trois langues', async ({ browser }) => {
  test.setTimeout(120_000);
  evenement = await creerEvenementJetable({ equipes: 8, langues: ['fr', 'en', 'ta'] });
  const service = clientService();
  for (const theme of THEMES) {
    const { data } = await service
      .from('contenus')
      .insert({ jeu: 'enchere2', etiquette: 'tout_public', actif: false })
      .select('id')
      .single();
    const id = data!['id'] as string;
    contenus.push(id);
    await service.from('contenus_traductions').insert(
      Object.entries(theme).map(([langue, [t]]) => ({
        contenu_id: id,
        langue,
        valeur: { theme: t },
      })),
    );
    await service.from('contenus_secrets').insert(
      Object.entries(theme).map(([langue, [, sujet]]) => ({
        contenu_id: id,
        langue,
        valeur: { sujet },
      })),
    );
  }
  const { data: m } = await service
    .from('manches')
    .insert({
      evenement_id: evenement.id,
      jeu: 'enchere2',
      ordre: 1,
      options: { themes: 6, chrono_s: 30 },
    })
    .select('id')
    .single();
  const manche = m!['id'] as string;
  const { data: passages } = await service
    .from('passages')
    .insert(
      contenus.map((c, i) => ({
        manche_id: manche,
        evenement_id: evenement.id,
        ordre: i + 1,
        contenu_id: c,
      })),
    )
    .select('id, ordre')
    .order('ordre');
  const passage = (n: number) => passages!.find((p) => p['ordre'] === n)!['id'] as string;

  const anna = await clientAnimateur('anna@teamup.test');
  const etape = async (pilotage: object, extra: object = {}) => {
    const { data } = await appeler<{ pilotage: { version: string } }>(anna, 'etat_ecran', {
      p_code: evenement.code,
    });
    const { erreur } = await appeler(anna, 'enregistrer_etape', {
      p_evenement: evenement.id,
      p_version: data!.pilotage.version,
      p_pilotage: { scene: 'jeu', manche_id: manche, ...pilotage },
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
    await expect(ecran.locator(`[data-scene="enchere2"][data-etape="${nom}"]`)).toBeVisible({
      timeout: 15_000,
    });
    await expect.poll(() => debords(ecran), { message: `débords (${nom})` }).toEqual([]);
    await ecran.screenshot({ path: test.info().outputPath(`surenchere-${nom}.png`) });
  };

  // Le sujet le plus long, chrono lancé.
  await etape(
    { passage_id: passage(1), etape: 'chrono', chrono: 'demarrer', chrono_duree_s: 30 },
    {
      p_manche: { id: manche, statut: 'en_cours' },
      p_passage: { id: passage(1), statut: 'en_cours' },
    },
  );
  await verifier('chrono');
  await expect(ecran.getByRole('timer')).toBeInViewport({ ratio: 1 });

  // Cinq thèmes joués : le verdict du cinquième, puis la grille, la plus chargée.
  for (let n = 1; n <= 5; n++) {
    await service
      .from('passages')
      .update({ statut: 'termine', resultat: { equipe_champion: n, tenu: n % 2 === 0 } })
      .eq('id', passage(n));
  }
  await etape({ passage_id: passage(5), etape: 'tenu', chrono: 'arreter' });
  await verifier('tenu');
  await etape({ passage_id: null, etape: 'themes', chrono: 'arreter' });
  await verifier('themes');
  await expect(ecran.locator('.tu-stage-theme')).toHaveCount(6);
});
