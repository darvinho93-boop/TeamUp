import { describe, expect, it } from 'vitest';
import {
  cheminExtrait,
  dureeLisible,
  estCheminExtrait,
  estMp4,
  extraitDe,
  extraitsDuProgramme,
  refusExtrait,
  TAILLE_MAX_EXTRAIT,
} from '../src/lib/extraits';

// Les huit premiers octets d'un MP4 : la taille de la boîte, puis « ftyp ».
const MP4 = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73]);
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00]);
const UUID = '0b8f6a52-3c1e-4f7a-9d2b-5e6f7a8b9c0d';

describe('une scène du Ciné-mime', () => {
  it('se reconnaît à sa boîte « ftyp »', () => {
    expect(estMp4(MP4)).toBe(true);
    expect(estMp4(MP3)).toBe(false);
    expect(estMp4(MP4.slice(0, 7))).toBe(false);
  });

  it('pèse au plus 40 Mo, se lit dans le navigateur et dure de 3 à 90 s', () => {
    const ok = { taille: 12_000_000, debut: MP4, dureeMs: 32_400 };
    expect(refusExtrait(ok)).toBeNull();
    expect(refusExtrait({ ...ok, taille: 0 })).toBe('vide');
    expect(refusExtrait({ ...ok, taille: TAILLE_MAX_EXTRAIT + 1 })).toBe('taille');
    expect(refusExtrait({ ...ok, debut: MP3 })).toBe('format');
    expect(refusExtrait({ ...ok, dureeMs: null })).toBe('illisible');
    expect(refusExtrait({ ...ok, dureeMs: Number.NaN })).toBe('illisible');
    expect(refusExtrait({ ...ok, dureeMs: 2_999 })).toBe('duree');
    expect(refusExtrait({ ...ok, dureeMs: 3_000 })).toBeNull();
    expect(refusExtrait({ ...ok, dureeMs: 90_000 })).toBeNull();
    expect(refusExtrait({ ...ok, dureeMs: 90_001 })).toBe('duree');
  });

  it('se range sous un uuid neuf', () => {
    expect(cheminExtrait(UUID)).toBe(`${UUID}.mp4`);
    expect(estCheminExtrait(`${UUID}.mp4`)).toBe(true);
    expect(estCheminExtrait(`${UUID}.mp3`)).toBe(false);
    expect(estCheminExtrait(`../${UUID}.mp4`)).toBe(false);
    expect(estCheminExtrait(42)).toBe(false);
  });

  it('se lit sans confiance dans l’état de l’écran', () => {
    expect(extraitDe({ chemin: `${UUID}.mp4`, duree_ms: 32_400 })).toEqual({
      chemin: `${UUID}.mp4`,
      dureeMs: 32_400,
    });
    expect(extraitDe(null)).toBeNull();
    expect(extraitDe({ chemin: 'autre.mp4', duree_ms: 1 })).toBeNull();
    expect(extraitDe({ chemin: `${UUID}.mp4`, duree_ms: '32' })).toBeNull();
  });

  it('dit sa durée simplement', () => {
    expect(dureeLisible(32_400)).toBe('32 s');
    expect(dureeLisible(65_000)).toBe('1 min 05');
  });
});

describe('les vidéos à précharger', () => {
  const extrait = (n: number) => ({ chemin: `${UUID.slice(0, -1)}${n}.mp4`, duree_ms: 10_000 });
  it('sont celles des passages à jouer et du passage en cours, une fois chacune', () => {
    const etat = {
      pilotage: { passage_id: 'p2' },
      programme: [
        {
          jeu: 'cinemime',
          statut: 'en_cours',
          passages: [
            { id: 'p1', statut: 'termine', extrait: extrait(1) },
            { id: 'p2', statut: 'termine', extrait: extrait(2) },
            { id: 'p3', statut: 'a_venir', extrait: extrait(3) },
            { id: 'p4', statut: 'a_venir', extrait: extrait(3) },
            { id: 'p5', statut: 'a_venir', extrait: null },
          ],
        },
        {
          jeu: 'cinemime',
          statut: 'annulee',
          passages: [{ id: 'x', statut: 'a_venir', extrait: extrait(4) }],
        },
        {
          jeu: 'mime2',
          statut: 'a_venir',
          passages: [{ id: 'y', statut: 'a_venir', extrait: extrait(5) }],
        },
      ],
    };
    expect(extraitsDuProgramme(etat)).toEqual([extrait(2).chemin, extrait(3).chemin]);
  });
});
