'use client';

import { useEffect, useState } from 'react';
import { Button, type ButtonProps } from '@teamup/ui/react';

/**
 * Action irréversible (valider un score, un verdict) : un premier appui arme le bouton, le
 * second exécute. Sans second appui, il se désarme seul. Pas de boîte de dialogue qui éblouit
 * en salle sombre ni ne se perd sous le pouce.
 */
export function BoutonConfirme({
  confirmation,
  onConfirm,
  children,
  ...rest
}: Omit<ButtonProps, 'onClick'> & { confirmation: string; onConfirm: () => void }) {
  const [arme, setArme] = useState(false);

  useEffect(() => {
    if (!arme) return;
    const minuterie = setTimeout(() => setArme(false), 4000);
    return () => clearTimeout(minuterie);
  }, [arme]);

  return (
    <Button
      {...rest}
      variant={arme ? 'accent' : (rest.variant ?? 'primary')}
      aria-live="polite"
      onClick={() => {
        if (arme) {
          setArme(false);
          onConfirm();
        } else {
          setArme(true);
        }
      }}
    >
      {arme ? confirmation : children}
    </Button>
  );
}
