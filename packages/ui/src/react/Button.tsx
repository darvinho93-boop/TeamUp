import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../classNames';

/** `accent` = corail : réservé à l'action (« c'est à toi », envoyer, demander un devis). */
export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'outline';
/** `sm` et `cta` servent la vitrine ; `lg` l'écran joueur. */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'cta';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'tu-btn',
        `tu-btn--${variant}`,
        size !== 'md' && `tu-btn--${size}`,
        block && 'tu-btn--block',
        className,
      )}
      {...rest}
    />
  );
}
