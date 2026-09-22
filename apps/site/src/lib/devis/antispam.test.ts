import { describe, expect, it } from 'vitest';
import { CHAMP_OUVERTURE, CHAMP_PIEGE, estUnRobot } from './antispam';

const MAINTENANT = 1_800_000_000_000;

function formulaire(champs: Record<string, string>): FormData {
  const form = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) form.append(nom, valeur);
  return form;
}

describe('estUnRobot', () => {
  it('laisse passer un humain : piège vide, formulaire ouvert depuis un moment', () => {
    const form = formulaire({ [CHAMP_PIEGE]: '', [CHAMP_OUVERTURE]: String(MAINTENANT - 60_000) });
    expect(estUnRobot(form, MAINTENANT)).toBe(false);
  });

  it('écarte un envoi dont le champ piège est rempli', () => {
    const form = formulaire({
      [CHAMP_PIEGE]: 'https://spam.example',
      [CHAMP_OUVERTURE]: String(MAINTENANT - 60_000),
    });
    expect(estUnRobot(form, MAINTENANT)).toBe(true);
  });

  it('écarte un envoi arrivé moins de 3 s après l’affichage', () => {
    const form = formulaire({ [CHAMP_OUVERTURE]: String(MAINTENANT - 2_000) });
    expect(estUnRobot(form, MAINTENANT)).toBe(true);
  });

  it('écarte un envoi sans horodatage ou avec un horodatage illisible', () => {
    expect(estUnRobot(formulaire({}), MAINTENANT)).toBe(true);
    expect(estUnRobot(formulaire({ [CHAMP_OUVERTURE]: 'hier' }), MAINTENANT)).toBe(true);
  });
});
