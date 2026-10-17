import type { CSSProperties } from 'react';
import { cx } from '@teamup/ui/react';
import { REVELATION, type LogoSoiree } from '@/lib/logo-soiree';
import { Monogramme } from '@/marque/Monogramme';
import { Ronds } from '@/marque/Ronds';

/** Les instants de `REVELATION`, en variables CSS : la feuille de style y cale chaque étape. */
const INSTANTS = {
  '--tu-rev-fond': `${REVELATION.fond}ms`,
  '--tu-rev-monogramme': `${REVELATION.monogramme}ms`,
  '--tu-rev-deploiement': `${REVELATION.deploiement}ms`,
  '--tu-rev-pose': `${REVELATION.pose}ms`,
  '--tu-rev-fin': `${REVELATION.fin}ms`,
} as CSSProperties;

/**
 * Le passage de l'ouverture à la page du QR code, par-dessus la scène déjà à jour : les ronds
 * forment le logo Team Up! une dernière fois, le marine du faire-part arrive, le monogramme de la
 * soirée paraît, se déploie en titre, et le panneau se replie en bandeau, à la place exacte de
 * celui de la page du QR. Sans logo, le logo Team Up! seul, puis la page.
 */
export function Revelation({ logo }: { logo: LogoSoiree | null }) {
  return (
    <div
      className={cx('tu-revelation', !logo && 'tu-revelation--sans-logo')}
      style={INSTANTS}
      data-testid="revelation"
      aria-hidden="true"
    >
      <div className="tu-revelation__marque">
        <Ronds mode="forme" dureeMs={REVELATION.fond} />
      </div>
      {logo && (
        <div className="tu-revelation__panneau">
          <Monogramme logo={logo} />
        </div>
      )}
    </div>
  );
}
