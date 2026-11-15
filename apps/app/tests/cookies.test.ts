import { describe, expect, it } from 'vitest';
import { DOMAINE_PARTAGE, domaineDuCookie, DUREE_SESSION_S } from '../src/lib/cookies';

/**
 * Lot 15 : la session et la langue sont posées pour tout `teamup-game.fr`, donc lues aussi bien
 * en ligne (`app.`) que sur la machine de la salle (`soiree.`) ; ailleurs, pour l'adresse seule.
 */
describe('domaine des cookies du joueur', () => {
  it('partagé entre l’app en ligne et la machine de la salle', () => {
    expect(domaineDuCookie('app.teamup-game.fr')).toBe(DOMAINE_PARTAGE);
    expect(domaineDuCookie('soiree.teamup-game.fr')).toBe(DOMAINE_PARTAGE);
    expect(domaineDuCookie('soiree.teamup-game.fr:443')).toBe(DOMAINE_PARTAGE);
    expect(domaineDuCookie('APP.TeamUp-Game.fr.')).toBe(DOMAINE_PARTAGE);
    expect(domaineDuCookie('teamup-game.fr')).toBe(DOMAINE_PARTAGE);
  });

  it('attaché à l’adresse seule ailleurs : poste, réseau local, aperçus, faux domaines', () => {
    for (const hote of [
      'localhost:3100',
      '127.0.0.1:3000',
      '192.168.10.244:3000',
      'teamup-app-git-main.vercel.app',
      'teamup-game.fr.exemple.com',
      'fauxteamup-game.fr',
      '',
      null,
      undefined,
    ]) {
      expect(domaineDuCookie(hote), String(hote)).toBeUndefined();
    }
  });

  it('une session tient trente jours : on s’inscrit parfois des semaines avant', () => {
    expect(DUREE_SESSION_S).toBe(30 * 24 * 60 * 60);
  });
});
