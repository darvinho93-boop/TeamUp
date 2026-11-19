/**
 * L'habillage du plateau (2026-11-19, audit « jeu télé ») : un halo de projecteur derrière le
 * contenu, et, pendant les attentes, les ronds du logo qui dérivent très pâles. Derrière la scène
 * (la scène isole ses calques, comme pour la photo de fond) ; tout en CSS (`habillage.css`),
 * immobile sous `prefers-reduced-motion`. La régie le retire pour une soirée.
 */
export function Habillage({ ronds }: { ronds: boolean }) {
  return (
    <div className="tu-habillage" aria-hidden="true" data-testid="habillage">
      <div className="tu-habillage__halo" />
      <div className="tu-habillage__ronds" data-visible={ronds ? 'true' : 'false'}>
        {(['navy', 'sauge', 'sable', 'or'] as const).map((teinte) => (
          <span key={teinte} className={`tu-habillage__rond tu-habillage__rond--${teinte}`} />
        ))}
      </div>
    </div>
  );
}
