import type { CSSProperties, ReactNode } from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { couleurs, polices } from './theme';

/** Durées des scènes, en images (30 par seconde). */
const BESOIN = 165;
const SOLUTION = 90;
const PAR_JEU = 60;
const PODIUM = 75;
const FIN = 120;

const JEUX = [
  {
    titre: 'Points communs',
    accroche: 'Devinez ce qui les rassemble.',
    image: 'captures/les-jeux-screen-0.png',
  },
  {
    titre: 'Quiz',
    accroche: 'Une question, quatre coins de salle.',
    image: 'captures/les-jeux-screen-1.png',
  },
  {
    titre: 'Surenchère',
    accroche: '« Dix ! — Douze ! » Tenez parole.',
    image: 'captures/les-jeux-screen-2.png',
  },
  {
    titre: 'Mime',
    accroche: 'Mimé, chuchoté… rarement intact.',
    image: 'captures/les-jeux-screen-3.png',
  },
  {
    titre: 'Photo challenge',
    accroche: 'Vos plus belles photos, en grand.',
    image: 'captures/les-jeux-screen-4.png',
  },
] as const;

export const DUREE_TOTALE = BESOIN + SOLUTION + JEUX.length * PAR_JEU + PODIUM + FIN;

/** Ressort de 0 à 1 qui démarre à l'image `debut`. */
function useRessort(debut: number, raideur = 14) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - debut, fps, config: { damping: raideur, mass: 0.7 } });
}

/** Fondu de sortie sur les dernières images d'une scène. */
function useSortie(duree: number, images = 8) {
  const frame = useCurrentFrame();
  return interpolate(frame, [duree - images, duree], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** Une ligne de texte qui monte en apparaissant. */
function Ligne({
  debut,
  children,
  style,
}: {
  debut: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const t = useRessort(debut);
  return (
    <div style={{ opacity: t, transform: `translateY(${(1 - t) * 60}px)`, ...style }}>
      {children}
    </div>
  );
}

/** Une capture du jeu, coins arrondis, légèrement recadrée pour perdre le fond de page. */
function Capture({
  source,
  largeur,
  ratio,
  rayon = 44,
  style,
}: {
  source: string;
  largeur: number;
  /** Hauteur ÷ largeur de l'image. */
  ratio: number;
  rayon?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: largeur,
        height: largeur * ratio,
        borderRadius: rayon,
        overflow: 'hidden',
        boxShadow: '0 40px 90px rgba(0, 0, 0, 0.35)',
        ...style,
      }}
    >
      <Img
        src={staticFile(source)}
        style={{ width: '100%', height: '100%', transform: 'scale(1.025)' }}
      />
    </div>
  );
}

const titre: CSSProperties = {
  fontFamily: polices.titre,
  fontWeight: 700,
  lineHeight: 1.08,
  letterSpacing: '-0.02em',
};

/* ---------- 1. Le besoin : des groupes séparés deviennent des équipes mélangées ---------- */

const GROUPES = [
  { x: 270, y: 1040, couleur: couleurs.navy700 },
  { x: 810, y: 1040, couleur: couleurs.sage500 },
  { x: 540, y: 1480, couleur: couleurs.ambre },
];
const EQUIPES = [
  { x: 290, y: 1010 },
  { x: 790, y: 1010 },
  { x: 290, y: 1510 },
  { x: 790, y: 1510 },
];
const PAR_GROUPE = 8;
const MELANGE = 92;

const INVITES = GROUPES.flatMap((groupe, g) =>
  Array.from({ length: PAR_GROUPE }, (_, k) => {
    // Chaque équipe reçoit deux invités de chaque groupe.
    const equipe = (k + g) % EQUIPES.length;
    // Les places tournent d'une équipe à l'autre : aucune ne ressemble à sa voisine.
    const place = (g * 2 + Math.floor(k / EQUIPES.length) * 3 + equipe * 2) % 6;
    const angleDepart = k * 2.4;
    const rayonDepart = 44 * Math.sqrt(k + 0.4);
    const angleArrivee = (place / 6) * Math.PI * 2 + equipe * 0.5;
    const centre = EQUIPES[equipe]!;
    return {
      couleur: groupe.couleur,
      depart: {
        x: groupe.x + Math.cos(angleDepart) * rayonDepart,
        y: groupe.y + Math.sin(angleDepart) * rayonDepart,
      },
      arrivee: {
        x: centre.x + Math.cos(angleArrivee) * 92,
        y: centre.y + Math.sin(angleArrivee) * 92,
      },
      ordre: g * PAR_GROUPE + k,
    };
  }),
);

function Besoin() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sortie = useSortie(BESOIN);
  const premiere = interpolate(frame, [MELANGE - 12, MELANGE - 2], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cercles = spring({ frame: frame - MELANGE - 14, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ background: couleurs.creme, opacity: sortie }}>
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 90,
          right: 90,
          ...titre,
          fontSize: 104,
          color: couleurs.navy700,
        }}
      >
        <div style={{ opacity: premiere, position: 'absolute', inset: 0 }}>
          <Ligne debut={4}>Vos invités</Ligne>
          <Ligne debut={12}>arrivent</Ligne>
          <Ligne debut={20}>en groupes.</Ligne>
        </div>
        <Ligne debut={MELANGE}>Ils repartent</Ligne>
        <Ligne debut={MELANGE + 8} style={{ color: couleurs.sage500 }}>
          en équipe.
        </Ligne>
      </div>

      {EQUIPES.map((equipe, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: equipe.x - 175,
            top: equipe.y - 175,
            width: 350,
            height: 350,
            borderRadius: '50%',
            border: `6px solid ${couleurs.pierre}`,
            background: couleurs.blanc,
            opacity: cercles,
            transform: `scale(${0.7 + cercles * 0.3})`,
          }}
        />
      ))}

      {INVITES.map((invite) => {
        const arrive = spring({ frame: frame - 6 - invite.ordre, fps, config: { damping: 11 } });
        const melange = spring({
          frame: frame - MELANGE - (invite.ordre % 8) * 2,
          fps,
          config: { damping: 15, mass: 0.9 },
        });
        const x = interpolate(melange, [0, 1], [invite.depart.x, invite.arrivee.x]);
        const y = interpolate(melange, [0, 1], [invite.depart.y, invite.arrivee.y]);
        return (
          <div
            key={invite.ordre}
            style={{
              position: 'absolute',
              left: x - 34,
              top: y - 34,
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: invite.couleur,
              transform: `scale(${arrive})`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/* ---------- 2. La solution : un animateur, un grand écran, un scan ---------- */

function Solution() {
  const sortie = useSortie(SOLUTION);
  const ecran = useRessort(26);
  const telephone = useRessort(38);

  return (
    <AbsoluteFill style={{ background: couleurs.navy900, opacity: sortie }}>
      <div
        style={{
          position: 'absolute',
          top: 290,
          left: 90,
          right: 90,
          ...titre,
          fontSize: 92,
          color: couleurs.blanc,
        }}
      >
        <Ligne debut={2}>Un animateur.</Ligne>
        <Ligne debut={10}>Un grand écran.</Ligne>
        <Ligne debut={18} style={{ color: couleurs.sage500 }}>
          Toute la salle joue.
        </Ligne>
      </div>

      <Capture
        source="captures/accueil-screen-2.png"
        largeur={960}
        ratio={798 / 1866}
        rayon={36}
        style={{
          position: 'absolute',
          top: 820,
          left: 60,
          opacity: ecran,
          transform: `translateY(${(1 - ecran) * 120}px)`,
        }}
      />
      <Capture
        source="captures/accueil-phone-0.png"
        largeur={360}
        ratio={1407 / 708}
        rayon={58}
        style={{
          position: 'absolute',
          top: 1090,
          left: 640,
          opacity: telephone,
          transform: `translateY(${(1 - telephone) * 200}px) rotate(${4 - telephone * 8}deg)`,
        }}
      />

      <Ligne
        debut={48}
        style={{
          position: 'absolute',
          left: 90,
          width: 500,
          top: 1470,
          fontFamily: polices.texte,
          fontWeight: 500,
          fontSize: 50,
          lineHeight: 1.3,
          color: couleurs.texteDouxScene,
        }}
      >
        Un scan, sans rien installer.
      </Ligne>
    </AbsoluteFill>
  );
}

/* ---------- 3. Les cinq jeux, deux secondes chacun ---------- */

function Jeu({ index }: { index: number }) {
  const frame = useCurrentFrame();
  const jeu = JEUX[index]!;
  const sortie = useSortie(PAR_JEU, 6);
  const image = useRessort(4, 13);
  const zoom = interpolate(frame, [0, PAR_JEU], [1, 1.06]);

  return (
    <AbsoluteFill style={{ background: couleurs.navy900 }}>
      <AbsoluteFill style={{ opacity: sortie }}>
        <div style={{ position: 'absolute', top: 270, left: 90, right: 90 }}>
          <Ligne
            debut={0}
            style={{
              fontFamily: polices.texte,
              fontWeight: 500,
              fontSize: 38,
              letterSpacing: '0.14em',
              color: couleurs.sage500,
            }}
          >
            JEU {index + 1} / {JEUX.length}
          </Ligne>
          <Ligne
            debut={3}
            style={{ ...titre, fontSize: 116, color: couleurs.blanc, marginTop: 18 }}
          >
            {jeu.titre}
          </Ligne>
          <Ligne
            debut={9}
            style={{
              fontFamily: polices.texte,
              fontWeight: 500,
              fontSize: 52,
              lineHeight: 1.25,
              color: couleurs.texteDouxScene,
              marginTop: 28,
            }}
          >
            {jeu.accroche}
          </Ligne>
        </div>

        <Capture
          source={jeu.image}
          largeur={980}
          ratio={1263 / 1800}
          style={{
            position: 'absolute',
            top: 900,
            left: 50,
            opacity: image,
            transform: `translateX(${(1 - image) * 260}px) scale(${zoom})`,
          }}
        />
      </AbsoluteFill>

      <div
        style={{
          position: 'absolute',
          bottom: 150,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 18,
        }}
      >
        {JEUX.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === index ? 64 : 18,
              height: 18,
              borderRadius: 9,
              background: i === index ? couleurs.sage500 : couleurs.navy500,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

/* ---------- 4. Le podium ---------- */

function Podium() {
  const sortie = useSortie(PODIUM);
  const image = useRessort(10, 12);

  return (
    <AbsoluteFill style={{ background: couleurs.navy900, opacity: sortie }}>
      <div
        style={{
          position: 'absolute',
          top: 440,
          left: 90,
          right: 90,
          ...titre,
          fontSize: 104,
          color: couleurs.blanc,
        }}
      >
        <Ligne debut={2}>Et un podium,</Ligne>
        <Ligne debut={10} style={{ color: couleurs.sage500 }}>
          pour finir
        </Ligne>
        <Ligne debut={16} style={{ color: couleurs.sage500 }}>
          en beauté.
        </Ligne>
      </div>
      <Capture
        source="captures/accueil-screen-1.png"
        largeur={980}
        ratio={783 / 1866}
        rayon={36}
        style={{
          position: 'absolute',
          top: 1000,
          left: 50,
          opacity: image,
          transform: `scale(${0.85 + image * 0.15})`,
        }}
      />
    </AbsoluteFill>
  );
}

/* ---------- 5. La signature et l'appel à l'action ---------- */

function Fin() {
  const logo = useRessort(2, 12);
  const bouton = useRessort(52, 11);

  return (
    <AbsoluteFill style={{ background: couleurs.creme, alignItems: 'center' }}>
      <Img
        src={staticFile('logo/teamup-mark-transparent.png')}
        style={{
          marginTop: 300,
          height: 300,
          opacity: logo,
          transform: `scale(${0.8 + logo * 0.2})`,
        }}
      />
      {/* Logotype : « Up » sauge et « ! » corail, comme sur le site. */}
      <Ligne debut={8} style={{ ...titre, fontSize: 130, color: couleurs.navy700, marginTop: 30 }}>
        Team <span style={{ color: couleurs.sage500 }}>Up</span>
        <span style={{ color: couleurs.corail }}>!</span>
      </Ligne>
      <div
        style={{
          marginTop: 80,
          textAlign: 'center',
          ...titre,
          fontSize: 78,
          color: couleurs.navy700,
        }}
      >
        <Ligne debut={16}>On joue.</Ligne>
        <Ligne debut={24}>On se rencontre.</Ligne>
        <Ligne debut={32}>On crée du lien.</Ligne>
      </div>
      <Ligne
        debut={44}
        style={{
          marginTop: 70,
          fontFamily: polices.texte,
          fontSize: 40,
          lineHeight: 1.4,
          textAlign: 'center',
          color: couleurs.texteDoux,
          padding: '0 90px',
        }}
      >
        Mariages · anniversaires
        <br />
        séminaires · team building
      </Ligne>
      <div
        style={{
          marginTop: 90,
          padding: '34px 72px',
          borderRadius: 999,
          background: couleurs.corail,
          color: couleurs.navy900,
          fontFamily: polices.titre,
          fontWeight: 600,
          fontSize: 54,
          opacity: bouton,
          transform: `scale(${0.7 + bouton * 0.3})`,
        }}
      >
        Demandez votre devis
      </div>
      <Ligne
        debut={62}
        style={{
          marginTop: 44,
          fontFamily: polices.titre,
          fontWeight: 600,
          fontSize: 56,
          color: couleurs.navy700,
        }}
      >
        teamup.fr
      </Ligne>
    </AbsoluteFill>
  );
}

export function Presentation() {
  const debutJeux = BESOIN + SOLUTION;
  const debutPodium = debutJeux + JEUX.length * PAR_JEU;

  return (
    <AbsoluteFill style={{ background: couleurs.navy900 }}>
      <Sequence durationInFrames={BESOIN}>
        <Besoin />
      </Sequence>
      <Sequence from={BESOIN} durationInFrames={SOLUTION}>
        <Solution />
      </Sequence>
      {JEUX.map((jeu, index) => (
        <Sequence key={jeu.titre} from={debutJeux + index * PAR_JEU} durationInFrames={PAR_JEU}>
          <Jeu index={index} />
        </Sequence>
      ))}
      <Sequence from={debutPodium} durationInFrames={PODIUM}>
        <Podium />
      </Sequence>
      <Sequence from={debutPodium + PODIUM} durationInFrames={FIN}>
        <Fin />
      </Sequence>
    </AbsoluteFill>
  );
}
