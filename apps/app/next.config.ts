import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Les paquets du workspace sont consommés en TypeScript source, sans étape de build.
  transpilePackages: ['@teamup/ui', '@teamup/game'],
  typedRoutes: true,
};

export default nextConfig;
