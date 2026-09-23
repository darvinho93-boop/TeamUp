import type { HTMLAttributes } from 'react';
import { cx } from '../classNames';

/** Logotype texte : « Team » navy, « Up » sauge, « ! » corail (exemption de contraste, lot 1). */
export function Wordmark({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('tu-wordmark', className)} {...rest}>
      Team <span className="tu-wordmark__up">Up</span>
      <span className="tu-wordmark__bang">!</span>
    </span>
  );
}
