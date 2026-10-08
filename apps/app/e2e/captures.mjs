// Revue visuelle : capture chaque écran de l'app en taille réelle, dans un dossier donné.
//   node e2e/captures.mjs <dossier> [CODE]
// À lancer depuis apps/app, serveur local démarré (pnpm dev), base locale avec ses comptes de démo.
import { chromium, devices } from '@playwright/test';

const [dossier, code = 'MEMBR3'] = process.argv.slice(2);
const URL = process.env.URL_APP ?? 'http://localhost:3000';
if (!dossier) throw new Error('Usage : node e2e/captures.mjs <dossier> [CODE]');

const navigateur = await chromium.launch();
const prendre = (page, nom) => page.screenshot({ path: `${dossier}/${nom}.png` });

async function connecter(contexte, email) {
  const page = await contexte.newPage();
  await page.goto(`${URL}/regie`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('motdepasse');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/regie');
  return page;
}

// ----- Régie (1 280 × 800) et écran commun (1 920 × 1 080), sous la même session.
const bureau = await navigateur.newContext({ viewport: { width: 1280, height: 800 } });
// En développement, la première visite d'une page la compile : on lui laisse le temps.
bureau.setDefaultNavigationTimeout(120_000);
const connexion = await bureau.newPage();
await connexion.goto(`${URL}/regie/connexion`);
await prendre(connexion, 'regie-00-connexion');
await connexion.close();

const regie = await connecter(bureau, 'anna@teamup.test');
await prendre(regie, 'regie-01-evenements');

// L'écran de chargement : on retient la page suivante le temps de le voir.
await regie.route('**/regie/compte*', async (route) => {
  await new Promise((fini) => setTimeout(fini, 3000));
  await route.continue().catch(() => {});
});
await regie.getByRole('link', { name: 'Mon compte' }).click();
await regie.waitForTimeout(450);
await prendre(regie, 'chargement-1-arrivee');
await regie.waitForTimeout(1700);
await prendre(regie, 'chargement-2-pose');
await regie.waitForURL('**/regie/compte');
for (const page of ['preparation', 'salle', 'photos', 'scores']) {
  await regie.goto(`${URL}/regie/${code}/${page}`);
  await regie.waitForLoadState('networkidle');
  await prendre(regie, `regie-02-${page}`);
}

const salle = await navigateur.newContext({
  viewport: { width: 1920, height: 1080 },
  storageState: await bureau.storageState(),
});
const ecran = await salle.newPage();
await ecran.goto(`${URL}/ecran/${code}`);
await ecran.locator('[data-en-direct="true"]').waitFor({ timeout: 20_000 });

await regie.goto(`${URL}/regie/${code}/pilotage`);
await regie.waitForLoadState('networkidle');
const touche = async (nom, attente = 900) => {
  const bouton = regie.getByRole('button', { name: nom, exact: true }).first();
  if (!(await bouton.isVisible().catch(() => false)) || !(await bouton.isEnabled())) return false;
  await bouton.click();
  await regie.waitForTimeout(attente);
  return true;
};

for (const [nom, fichier] of [
  ['Accueil', 'ecran-01-accueil'],
  ['Équipes', 'ecran-02-equipes'],
  ['Programme', 'ecran-03-programme'],
  ['Scores', 'ecran-04-scores'],
  ['Podium', 'ecran-05-podium'],
]) {
  if (await touche(nom)) await prendre(ecran, fichier);
}

// Un passage de Points communs, étape par étape, si la soirée en a un de prêt.
if (await touche('Présenter', 350)) {
  await prendre(ecran, 'ecran-06a-interlude');
  await regie.waitForTimeout(1500);
  await prendre(ecran, 'ecran-06-intro');
  if (await touche('Expliquer', 2500)) {
    await prendre(ecran, 'ecran-07-explication');
    await touche('Arrêter');
  }
}
await touche('Commencer : Points communs');
await prendre(ecran, 'ecran-08-jeu-pret');
await prendre(regie, 'regie-03-pilotage');
if (await touche('Afficher')) await prendre(ecran, 'ecran-09-jeu-consigne');
if (await touche('Masquer')) await prendre(ecran, 'ecran-10-jeu-masque');
if (await touche('Lancer', 2500)) {
  await prendre(ecran, 'ecran-11-jeu-lance');
  await prendre(regie, 'regie-04-pilotage-lance');
  await regie.getByRole('button', { name: 'Valider', exact: true }).click();
  await regie.getByRole('button', { name: 'Confirmer : Valider' }).click();
  await regie.waitForTimeout(1200);
  await prendre(ecran, 'ecran-12-jeu-trouve');
}
await touche('Scores');
await prendre(ecran, 'ecran-13-scores-apres');

// ----- Back-office.
const admin = await navigateur.newContext({ viewport: { width: 1280, height: 800 } });
admin.setDefaultNavigationTimeout(120_000);
const office = await connecter(admin, 'admin@teamup.test');
for (const page of ['', '/contenus', '/animateurs', '/mesure']) {
  await office.goto(`${URL}/admin${page}`);
  await office.waitForLoadState('networkidle');
  await prendre(office, `admin${page.replace('/', '-') || '-accueil'}`);
}

// ----- Téléphone d'un invité.
const mobile = await navigateur.newContext({ ...devices['Pixel 7'] });
const telephone = await mobile.newPage();
await telephone.goto(`${URL}/`);
await prendre(telephone, 'joueur-01-code');
await telephone.goto(`${URL}/${code}`);
await telephone.waitForLoadState('networkidle');
await prendre(telephone, 'joueur-02-arrivee');
const arrivee = await telephone.request.post(`${URL}/api/partie/${code}/rejoindre`, {
  data: { prenom: 'Capture', langue: 'fr' },
});
if (arrivee.ok()) {
  await telephone.goto(`${URL}/${code}`);
  await telephone.waitForLoadState('networkidle');
  await prendre(telephone, 'joueur-03-attente');
}

await navigateur.close();
console.log('captures prises dans', dossier);
