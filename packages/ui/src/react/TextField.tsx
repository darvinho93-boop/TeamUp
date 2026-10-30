import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { cx } from '../classNames';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  /** Message d'erreur en toutes lettres : la couleur seule ne porte jamais l'information. */
  error?: string;
  /**
   * Un texte d'une ligne logique qui peut être long (question de quiz, réponse) : il passe à la
   * ligne et le champ grandit avec lui, au lieu d'être coupé. Entrée n'y ajoute pas de saut.
   */
  multiline?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  className,
  required,
  multiline = false,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = cx(hint && hintId, error && errorId) || undefined;
  const commun = {
    id,
    required,
    'aria-invalid': error !== undefined,
    'aria-describedby': describedBy,
  };

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
      {multiline ? (
        <textarea
          className="tu-field__control tu-field__control--ligne"
          rows={1}
          {...commun}
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          onKeyDown={(e) => {
            // Une seule ligne logique : Entrée ne crée pas de saut dans le texte enregistré.
            if (e.key === 'Enter') e.preventDefault();
          }}
        />
      ) : (
        <input className="tu-field__control" {...commun} {...rest} />
      )}
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
