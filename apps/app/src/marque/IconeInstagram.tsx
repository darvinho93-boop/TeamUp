import { cx } from '@teamup/ui/react';

/** Le glyphe d'Instagram (carré arrondi, objectif, flash), au trait, en `currentColor`. */
export function IconeInstagram({ className }: { className?: string }) {
  return (
    <svg className={cx('tu-icone-insta', className)} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.3" fill="currentColor" />
    </svg>
  );
}
