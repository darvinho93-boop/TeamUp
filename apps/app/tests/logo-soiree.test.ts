import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REVELATION, REVELATION_MS } from '../src/lib/logo-soiree';

describe('le minutage de la révélation', () => {
  it('avance étape par étape', () => {
    const etapes = Object.values(REVELATION);
    expect([...etapes].sort((a, b) => a - b)).toEqual(etapes);
  });

  it('dure autant que le token --tu-dur-revelation', () => {
    const tokens = readFileSync(
      new URL('../../../packages/ui/src/styles/tokens-layout.css', import.meta.url),
      'utf8',
    );
    expect(tokens).toContain(`--tu-dur-revelation: ${REVELATION_MS}ms;`);
  });
});
