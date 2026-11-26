'use client';

import type { CSSProperties } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { Wordmark } from '@teamup/ui/react';
import { Karaoke } from '@/ecran/Karaoke';
import { useEchelleScene } from '@/ecran/useEchelleScene';
import { MESSAGES } from '@/i18n/messages';
import type { LigneParoles } from '@/lib/paroles';
import { Ronds } from '@/marque/Ronds';

/** Des phrases d'essai, de la longueur d'une ligne chantée : jamais de vraies paroles. */
const TEXTES: Record<string, readonly string[]> = {
  courte: ['La salle se lève doucement', 'Une ligne pour essayer', 'Et la suivante arrive déjà'],
  longue: [
    'Une ligne assez longue pour vérifier que tout tient bien sur une seule rangée',
    'Une ligne très longue, avec beaucoup de mots, pour voir jusqu’où sa taille se réduit à l’écran commun',
    'Et une dernière ligne, plutôt longue elle aussi, pour la suite',
  ],
  tamoul: [
    'இது கரோக்கே திரைக்கான ஒரு சோதனை வரி',
    'தமிழ் எழுத்துகள் சரியாகத் தெரிகிறதா என்று பார்க்கிறோம்',
    'அடுத்த வரி இங்கே காத்திருக்கிறது',
  ],
  aucune: [],
};

/** Les mêmes phrases tamoules en lettres latines, sous chacune (`texte=latin`). */
const LATIN = [
  'Idhu karaoke thiraikkaana oru sodhanai vari',
  'Thamizh ezhuthugal sariyaaga therigiradhaa endru paarkkirom',
  'Aduththa vari inge kaaththirukkiradhu',
];

export function KitKaraoke({ equipe, texte }: { equipe: number; texte: string }) {
  const [cadre, echelle] = useEchelleScene('contenir', 1);
  const latin = texte === 'latin';
  const paroles: LigneParoles[] = (TEXTES[latin ? 'tamoul' : texte] ?? []).map((l, i) => ({
    t_ms: i * 4000,
    texte: l,
    ...(latin ? { latin: LATIN[i]! } : {}),
  }));
  return (
    <div
      ref={cadre}
      className="tu-stage-cadre"
      style={{ '--tu-stage-echelle': echelle } as CSSProperties}
    >
      <NextIntlClientProvider locale="fr" messages={MESSAGES.fr}>
        <div className="tu-stage tu-stage--projete" lang="fr">
          {/* Figé au milieu de la deuxième ligne : chrono nul, la position ne bouge pas. */}
          <Karaoke
            titre="Titre de la chanson"
            artiste="Nom de l’artiste"
            equipe={{ numero: equipe, nom: `Équipe ${equipe}` }}
            points={100}
            fete={false}
            paroles={paroles}
            debutS={0}
            ecouteMs={6000}
            chronoDepartMs={null}
            decalageMs={0}
          />
          <span className="tu-stage__insta">@teamup_officiel</span>
          <span className="tu-marque tu-stage__picto">
            <Ronds mode="coin" />
            <Wordmark className="tu-stage__nom" />
          </span>
        </div>
      </NextIntlClientProvider>
    </div>
  );
}
