import { EnTete } from '@/regie/EnTete';
import { evenementDeLaRegie } from '@/serveur/regie';

export default async function LayoutEvenement({ children, params }: LayoutProps<'/regie/[code]'>) {
  const { evenement } = await evenementDeLaRegie((await params).code);
  return (
    <>
      <EnTete evenement={evenement} />
      <main className="tu-regie__main">{children}</main>
    </>
  );
}
