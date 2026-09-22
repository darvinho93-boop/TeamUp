import { defineConfig } from 'vitest/config';

// Les tests de cette app parlent à la base locale : plus lents qu'un test pur, et sériels
// pour ne pas se marcher dessus sur les mêmes lignes de démo.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
