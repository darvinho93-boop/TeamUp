'use client';

import type { CSSProperties } from 'react';
import {
  aleaDepuis,
  dimensionsTableau,
  prochaineSequence,
  tirerTableau,
  type Duelliste,
} from '@teamup/game';
import { Salle } from '@/ecran/Salle';
import { useEchelleScene } from '@/ecran/useEchelleScene';
import type { EtatSalle, TournoiSalle } from '@/lib/salle';
import type { MatchSalle } from '@/lib/tournoi';

const PRENOMS = [
  'Camille',
  'Inès',
  'Kumar',
  'Priya',
  'Malik',
  'Léa',
  'Hugo',
  'Fatou',
  'Oscar',
  'Nora',
  'Élias',
  'Jade',
  'Balasubramaniam',
  'Marie-Alexandrine',
  'Gaspard',
  'Dina',
];

/** Un tableau joué jusqu'au tour demandé, gagnants tirés d'une graine : la même page à chaque fois. */
function tableauAuTour(joueurs: number, tour: number, gobelets: number, etape: string) {
  const salle: Duelliste[] = Array.from({ length: joueurs }, (_, i) => ({
    joueur_id: `j${i}`,
    prenom: i < PRENOMS.length ? PRENOMS[i]! : `${PRENOMS[i % PRENOMS.length]} ${i}`,
    equipe: (i % 8) + 1,
  }));
  const alea = aleaDepuis('kit-tournoi');
  const matchs = (tirerTableau(salle, alea) ?? []).map((m): MatchSalle => ({
    ...m,
    id: `${m.tour}-${m.rang}`,
  }));
  const juger = (m: MatchSalle) => {
    m.gagnant = alea() < 0.5 ? 0 : 1;
    const suivant = matchs.find((s) => s.tour === m.tour + 1 && s.rang === m.rang >> 1);
    if (suivant) suivant[m.rang % 2 === 0 ? 'a' : 'b'] = m.gagnant === 0 ? m.a : m.b;
  };

  const { tours } = dimensionsTableau(joueurs);
  const cible = Math.min(tour, tours);
  let numero = 0;
  for (const m of matchs) {
    if (m.tour < cible && m.gagnant === null) {
      m.sequence = ++numero;
      m.poste = 1;
      juger(m);
    }
  }
  if (etape === 'tirage') return { matchs, courants: [], numero: null };
  const suite = prochaineSequence(matchs, gobelets);
  const courants = suite?.matchs ?? [];
  courants.forEach((m, i) => {
    m.sequence = numero + 1;
    m.poste = i + 1;
    // En cours de résultats : un match sur deux jugé.
    if (etape === 'juge' || (etape === 'resultats' && i % 2 === 0)) juger(m);
  });
  return { matchs, courants, numero: numero + 1 };
}

export function KitTournoi({
  joueurs,
  tour,
  gobelets,
  etape,
}: {
  joueurs: number;
  tour: number;
  gobelets: number;
  etape: string;
}) {
  const [cadre, echelle] = useEchelleScene('contenir', 1);
  const { matchs, courants, numero } = tableauAuTour(joueurs, tour, gobelets, etape);
  const { tours } = dimensionsTableau(joueurs);
  const tournoi: TournoiSalle = {
    gobelets,
    joueurs,
    tours,
    sequence: numero,
    tour: courants[0]?.tour ?? null,
    reste: matchs.some((m) => m.gagnant === null && m.sequence === null),
    en_lice: joueurs - matchs.filter((m) => m.gagnant !== null && m.b !== null).length,
    matchs: courants,
    tableau: matchs,
  };
  const etat: EtatSalle = {
    serveur_ms: 0,
    evenement: {
      id: 'kit',
      code: 'KITTOU',
      langues: ['fr'],
      statut: 'en_cours',
      client_nom: 'Contrôle',
      creneau_minutes: 60,
      photos_closes: false,
    },
    pilotage: {
      scene: 'jeu',
      manche_id: 'cup',
      passage_id: 'p1',
      etape: etape === 'juge' ? 'resultats' : etape,
      indices: 0,
      chrono_depart_ms: null,
      chrono_duree_s: null,
      version: 'kit',
    },
    tournoi,
    equipes: Array.from({ length: 8 }, (_, i) => ({
      id: `e${i + 1}`,
      numero: i + 1,
      nom: `Équipe ${i + 1}`,
      points: 0,
      joueurs: Math.ceil(joueurs / 8),
      prenoms: [],
    })),
    joueurs,
    connectes: joueurs,
    programme: [
      {
        id: 'cup',
        jeu: 'cup',
        ordre: 1,
        statut: 'en_cours',
        options: { format: 'tournoi', gobelets },
        passages: [
          {
            id: 'p1',
            ordre: 1,
            statut: 'en_cours',
            equipe_id: null,
            points: null,
            resultat: {},
            contenu_id: null,
            public: {},
            secret: null,
          },
        ],
      },
    ],
  };
  return (
    <div
      ref={cadre}
      className="tu-stage-cadre"
      style={{ '--tu-stage-echelle': echelle } as CSSProperties}
    >
      <Salle etat={etat} decalageMs={0} qrSvg="" adresse="" projete />
    </div>
  );
}
