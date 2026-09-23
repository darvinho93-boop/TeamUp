import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Régie', template: '%s · Régie · Team Up!' },
  robots: { index: false },
};

/** Régie : thème stage, pour ne pas éblouir en salle sombre. */
export default function RegieLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tu-regie" data-theme="stage">
      {children}
    </div>
  );
}
