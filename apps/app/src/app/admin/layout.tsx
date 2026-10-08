import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { exigerAdmin } from '@/serveur/supabase-animateur';
import { EnTete } from '@/regie/EnTete';
import { NavAdmin } from '@/admin/NavAdmin';

export const metadata: Metadata = {
  title: { default: 'Back-office', template: '%s · Back-office · Team Up!' },
  robots: { index: false },
};

/**
 * Back-office : réservé aux admins. Même coque que la régie (thème stage) : un admin est un
 * animateur qui a un rôle de plus, il ne change pas d'outil.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await exigerAdmin();
  return (
    <div className="tu-regie">
      <EnTete admin nav={<NavAdmin />} />
      <main className="tu-regie__main">{children}</main>
    </div>
  );
}
