import { KitKaraoke } from './KitKaraoke';

export const metadata = { title: 'Karaoké (contrôle)' };

/**
 * Page de contrôle du karaoké, sans base : `?equipe=1` à 8, `&texte=courte|longue|tamoul|aucune`.
 * Des phrases d'essai, jamais de vraies paroles.
 */
export default async function PageKitKaraoke({ searchParams }: PageProps<'/kit-ui/karaoke'>) {
  const p = await searchParams;
  const n = typeof p['equipe'] === 'string' ? Number(p['equipe']) : 3;
  const texte = typeof p['texte'] === 'string' ? p['texte'] : 'courte';
  return (
    <KitKaraoke
      equipe={Number.isInteger(n) ? Math.min(8, Math.max(1, n)) : 3}
      texte={['courte', 'longue', 'tamoul', 'aucune'].includes(texte) ? texte : 'courte'}
    />
  );
}
