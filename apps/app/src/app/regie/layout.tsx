import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Régie', template: '%s · Régie · Team Up!' },
  robots: { index: false },
};

/** Régie : même fond beige que le reste de l'app (2026-10-09). */
export default function RegieLayout({ children }: { children: ReactNode }) {
  return <div className="tu-regie">{children}</div>;
}
