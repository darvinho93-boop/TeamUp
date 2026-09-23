import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { normaliserCode } from '@/lib/partie';
import { Arrivee } from '@/joueur/Arrivee';
import { EcranJoueur } from '@/joueur/EcranJoueur';
import { SaisieCode } from '@/joueur/SaisieCode';
import { etatDuJoueur, evenementPublic } from '@/serveur/partie';

export const metadata: Metadata = { robots: { index: false } };

/**
 * `app.teamup.fr/K7P2M9` : l'adresse du QR code. Un joueur qui a déjà sa session dans cette
 * salle retrouve son écran d'attente sans rien ressaisir ; les autres commencent l'arrivée.
 */
export default async function Partie({ params }: PageProps<'/[code]'>) {
  const code = normaliserCode((await params).code);
  if (!code) return <SaisieCode erreurInitiale="codeInconnu" />;

  const etat = await etatDuJoueur(code);
  if (etat) return <EcranJoueur code={code} etatInitial={etat} />;

  const evenement = await evenementPublic(code);
  if (!evenement) return <SaisieCode erreurInitiale="codeInconnu" />;

  return <Arrivee code={code} langues={evenement.langues} langueCourante={await getLocale()} />;
}
