import { Fragment } from 'react';
import { deploiement, type LogoSoiree } from '@/lib/logo-soiree';

/**
 * Le logo d'une soirée, dans l'habillage de son faire-part : le monogramme (« V | M ») et le
 * titre qu'il devient (« Vinoyan & Mélanie »). Dans la révélation, chaque initiale se déploie en
 * son mot (`deploiement`) ; si une initiale ne trouve pas son mot, le titre vient en fondu. Hors
 * de la révélation (`titreSeul`), le titre seul, tel quel : c'est le bandeau de la page du QR.
 */
export function Monogramme({ logo, titreSeul = false }: { logo: LogoSoiree; titreSeul?: boolean }) {
  const segments = deploiement(logo.initiales, logo.titre);
  return (
    <div className="tu-soiree">
      {!titreSeul && (
        <p className="tu-soiree__monogramme" aria-hidden="true">
          {logo.initiales.map((initiale, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="tu-soiree__trait">|</span>}
              {initiale}
            </Fragment>
          ))}
        </p>
      )}
      <p className="tu-soiree__titre" data-testid="titre-soiree">
        {titreSeul || !segments
          ? logo.titre
          : segments.map((segment, i) =>
              segment.type === 'mot' ? (
                <Fragment key={i}>
                  {segment.tete}
                  <span className="tu-soiree__reste">{segment.reste}</span>
                </Fragment>
              ) : (
                <span key={i} className="tu-soiree__liant">
                  {segment.texte}
                </span>
              ),
            )}
      </p>
    </div>
  );
}
