import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.astro/**',
      '**/.turbo/**',
      '**/.vercel/**',
      // Référence visuelle uniquement : styles en ligne, jamais reconstruits tels quels.
      'design/maquettes/**',
      // Généré par `pnpm db:types` depuis le schéma Supabase.
      'apps/app/src/types/base.ts',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.browser,
    },
  },

  {
    files: ['**/*.tsx'],
    extends: [jsxA11y.flatConfigs.recommended, reactHooks.configs.flat.recommended],
  },

  astro.configs.recommended,
  astro.configs['jsx-a11y-recommended'],

  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },

  prettier,
);
