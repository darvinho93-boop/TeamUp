import { KitTournoi } from './KitTournoi';

export const metadata = { title: 'Arbre du tournoi (contrôle)' };

const nombre = (valeur: unknown, defaut: number, min: number, max: number) => {
  const n = typeof valeur === 'string' ? Number(valeur) : NaN;
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : defaut;
};

/**
 * Page de contrôle de l'arbre, sans base : `?joueurs=100` (2 à 150), `&tour=3` (le tour en cours),
 * `&gobelets=16`, `&etape=tirage|appel|resultats|juge`.
 */
export default async function PageKitTournoi({ searchParams }: PageProps<'/kit-ui/tournoi'>) {
  const p = await searchParams;
  const etape = typeof p['etape'] === 'string' ? p['etape'] : 'appel';
  return (
    <KitTournoi
      joueurs={nombre(p['joueurs'], 100, 2, 150)}
      tour={nombre(p['tour'], 1, 1, 8)}
      gobelets={nombre(p['gobelets'], 16, 2, 32)}
      etape={['tirage', 'appel', 'resultats', 'juge'].includes(etape) ? etape : 'appel'}
    />
  );
}
