import { getLocale } from 'next-intl/server';
import { CadreCarte } from '@/carte/CadreCarte';
import { CommentJouer } from '@/carte/CommentJouer';
import { Jeux } from '@/carte/Jeux';
import { QuiSommesNous } from '@/carte/QuiSommesNous';
import { cibleInscription } from '@/carte/liens';
import { Soirees } from '@/carte/Soirees';
import { estLangue, type SoireeDuJour } from '@/lib/partie';

export const metadata = { title: 'Carte Team Up! (contrôle)' };

const MARIAGE: SoireeDuJour = {
  code: 'KITUNE',
  titre: 'Le mariage de Léa & Sam',
  langues: ['fr', 'en', 'ta'],
  statut: 'preparation',
  programme: ['list2', 'qcm2', 'enchere2', 'qcm2', 'mime2', 'photo2'],
};

const SEMINAIRE: SoireeDuJour = {
  code: 'KITDEU',
  titre: 'Séminaire de l’équipe Atlas',
  langues: ['fr'],
  statut: 'en_cours',
  programme: ['qcm2', 'mime2', 'cup'],
};

const ETATS: Record<string, SoireeDuJour[]> = {
  une: [MARIAGE],
  deux: [MARIAGE, SEMINAIRE],
  vide: [],
};

/**
 * Page de contrôle des pages de la carte, sans base : `?etat=une` (défaut), `deux` ou `vide`, et
 * `?page=jeux`, `comment` ou `nous` pour les autres onglets. La langue se change comme sur la vraie page.
 */
export default async function KitSoirees({ searchParams }: PageProps<'/kit-ui/soirees'>) {
  const parametres = await searchParams;
  const etat = typeof parametres['etat'] === 'string' ? parametres['etat'] : 'une';
  const soirees = ETATS[etat] ?? [];
  const langue = await getLocale();
  const inscription = cibleInscription(soirees, estLangue(langue) ? langue : 'fr');
  switch (parametres['page']) {
    case 'jeux':
      return (
        <CadreCarte actif="jeux">
          <Jeux inscription={inscription} />
        </CadreCarte>
      );
    case 'comment':
      return (
        <CadreCarte actif="comment">
          <CommentJouer inscription={inscription} />
        </CadreCarte>
      );
    case 'nous':
      return (
        <CadreCarte actif="nous">
          <QuiSommesNous />
        </CadreCarte>
      );
  }
  return (
    <CadreCarte actif="soirees">
      <Soirees soirees={soirees} langue={langue} />
    </CadreCarte>
  );
}
