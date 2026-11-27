import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { identifiantAleatoire } from '../src/lib/identifiant';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('un identifiant tiré au hasard', () => {
  it('prend celui du navigateur quand il existe', () => {
    expect(
      identifiantAleatoire({ getRandomValues: () => null as never, randomUUID: () => 'x' }),
    ).toBe('x');
  });

  it('se fabrique sans `randomUUID` (page en http par l’adresse du PC de la salle)', () => {
    const sansRandomUUID = { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) };
    const vus = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const id = identifiantAleatoire(sansRandomUUID);
      expect(id).toMatch(V4);
      vus.add(id);
    }
    expect(vus.size).toBe(200);
  });
});
