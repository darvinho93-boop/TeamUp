import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // Les paquets du workspace sont consommés en TypeScript source, sans étape de build.
  transpilePackages: ['@teamup/ui', '@teamup/game'],
  typedRoutes: true,
  // La version de la machine de la salle (lot 15) se construit à part (`TU_DIST_DIR=.next-machine`) :
  // elle ne remplace pas celle des tests e2e.
  distDir: process.env.TU_DIST_DIR || '.next',
  // Essai sur le réseau local (`pnpm dev:host`) : en développement, Next refuse les appareils
  // qui n'arrivent pas par localhost. `TU_DEV_ORIGINES=192.168.10.244` autorise l'adresse du poste.
  allowedDevOrigins: process.env.TU_DEV_ORIGINES?.split(',').filter(Boolean) ?? [],
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
