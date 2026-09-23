import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // Les paquets du workspace sont consommés en TypeScript source, sans étape de build.
  transpilePackages: ['@teamup/ui', '@teamup/game'],
  typedRoutes: true,
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
