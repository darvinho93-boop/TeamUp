import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import tokens from '@teamup/brand/tokens.json';
import favicon32 from '@teamup/brand/icons/favicon32.png';
import appleTouchIcon from '@teamup/brand/icons/appletouchicon.png';
import '@teamup/ui/styles.css';
import '@teamup/ui/fonts-tamil.css';

export const metadata: Metadata = {
  title: { default: 'Team Up!', template: '%s · Team Up!' },
  description: 'On joue. On se rencontre. On crée du lien.',
  icons: {
    icon: [{ url: favicon32.src, sizes: '32x32', type: 'image/png' }],
    apple: [{ url: appleTouchIcon.src }],
  },
};

export const viewport: Viewport = {
  themeColor: tokens.color.brand.navy.value,
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // La langue du joueur est choisie dans l'app et mémorisée ; le français reste le défaut.
  const langue = await getLocale();
  return (
    <html lang={langue}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
