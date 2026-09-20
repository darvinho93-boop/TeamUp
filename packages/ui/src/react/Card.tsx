import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../classNames';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  lift?: boolean;
}

export function Card({ title, lift = false, className, children, ...rest }: CardProps) {
  return (
    <div className={cx('tu-card', lift && 'tu-card--lift', className)} {...rest}>
      {title !== undefined && <h3 className="tu-card__title">{title}</h3>}
      <div className="tu-card__body">{children}</div>
    </div>
  );
}
