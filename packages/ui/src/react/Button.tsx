import type { ButtonHTMLAttributes } from 'react';
import { cx } from '../classNames';

/** `accent` = corail : réservé à l'action (« c'est à toi », envoyer, demander un devis). */
export type ButtonVariant = 'primary' | 'accent' | 'ghost';
export type ButtonSize = 'md' | 'lg';

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
        size === 'lg' && 'tu-btn--lg',
        block && 'tu-btn--block',
        className,
      )}
      {...rest}
    />
  );
}
