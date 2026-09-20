import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';
import { cx } from '../classNames';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  /** Message d'erreur en toutes lettres : la couleur seule ne porte jamais l'information. */
  error?: string;
}

export function TextField({ label, hint, error, className, required, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = cx(hint && hintId, error && errorId) || undefined;

  return (
    <div className={cx('tu-field', error && 'tu-field--invalid', className)}>
      <label className="tu-field__label" htmlFor={id}>
        {label}
        {required === true && (
          <span className="tu-field__required" aria-hidden="true">
            {' *'}
          </span>
        )}
      </label>
      <input
        id={id}
        className="tu-field__control"
        required={required}
        aria-invalid={error !== undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint !== undefined && (
        <p className="tu-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p className="tu-field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
