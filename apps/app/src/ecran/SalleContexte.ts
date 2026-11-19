'use client';

import { createContext } from 'react';

/**
 * Ce que les scènes savent de l'écran qui les montre (2026-11-19) : l'aperçu de la régie, et si
 * la scène est celle trouvée au chargement (`premiere`). Le suspense du quiz et le classement qui
 * monte ne se jouent ni dans l'aperçu, ni sur une scène trouvée au chargement.
 */
export const SalleContexte = createContext<{ apercu: boolean; premiere: boolean }>({
  apercu: false,
  premiere: true,
});
