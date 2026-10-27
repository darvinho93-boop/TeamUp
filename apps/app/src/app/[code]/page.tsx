import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { MESSAGES } from '@/i18n/messages';
import { normaliserCode } from '@/lib/partie';
import { Arrivee } from '@/joueur/Arrivee';
import { EcranJoueur } from '@/joueur/EcranJoueur';
import { SaisieCode } from '@/joueur/SaisieCode';
import { etatDuJoueur, evenementPublic } from '@/serveur/partie';

export const metadata: Metadata = { robots: { index: false } };

/**
 * `app.teamup-game.fr/K7P2M9` : l'adresse du QR code. Un joueur qui a déjà sa session dans cette
 * salle retrouve son écran d'attente sans rien ressaisir ; les autres commencent l'arrivée.
 */
export default async function Partie({ params }: PageProps<'/[code]'>) {
  const code = normaliserCode((await params).code);
  if (!code) return <SaisieCode erreurInitiale="codeInconnu" />;

  const [etat, evenement] = await Promise.all([etatDuJoueur(code), evenementPublic(code)]);
  if (etat) {
    const ecran = <EcranJoueur code={code} etatInitial={etat} groupes={evenement?.groupes ?? []} />;
    // La langue du joueur est celle qu'il a choisie à l'arrivée, gardée sur lui : sans le cookie
    // de langue (autre navigateur, données effacées), ses écrans ne repassent pas en français
    // pendant que les contenus du jeu restent dans sa langue.
    const langue = etat.joueur.langue;
    if (langue === (await getLocale())) return ecran;
    return (
      <NextIntlClientProvider locale={langue} messages={MESSAGES[langue]}>
        <div lang={langue}>{ecran}</div>
      </NextIntlClientProvider>
    );
  }

  if (!evenement) return <SaisieCode erreurInitiale="codeInconnu" />;

  return (
    <Arrivee
      code={code}
      langues={evenement.langues}
      groupes={evenement.groupes}
      groupeFacultatif={evenement.groupe_facultatif ?? true}
      langueCourante={await getLocale()}
    />
  );
}
