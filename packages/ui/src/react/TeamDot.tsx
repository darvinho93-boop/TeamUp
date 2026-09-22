import type { HTMLAttributes } from 'react';
import { cx } from '../classNames';
import { teamModifier } from '../teams';

export interface TeamDotProps extends HTMLAttributes<HTMLSpanElement> {
  /** Numéro d'équipe, de 1 à 8 : il porte la couleur. Au-delà, on lève. */
  index: number;
  name: string;
  variant?: 'dot' | 'badge';
  size?: 'md' | 'lg';
}

export function TeamDot({
  index,
  name,
  variant = 'dot',
  size = 'md',
  className,
  ...rest
}: TeamDotProps) {
  return (
    <span
      className={cx(
        'tu-team',
        teamModifier(index),
        variant === 'badge' && 'tu-team--badge',
        size === 'lg' && 'tu-team--lg',
        className,
      )}
      {...rest}
    >
      <span className="tu-team__dot" aria-hidden="true" />
      {name}
    </span>
  );
}
