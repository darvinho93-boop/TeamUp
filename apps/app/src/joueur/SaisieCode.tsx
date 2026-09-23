'use client';

import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@teamup/ui/react';
import { normaliserCode } from '@/lib/partie';
import { Cadre } from './Cadre';

const CASES = 6;

type Erreur = 'codeIncomplet' | 'codeInconnu';

/** Écran Rejoindre : le filet de sécurité quand on n'arrive pas par le QR code. */
export function SaisieCode({ erreurInitiale }: { erreurInitiale?: Erreur }) {
  const t = useTranslations('rejoindre');
  const router = useRouter();
  const [valeurs, setValeurs] = useState(() => Array.from({ length: CASES }, () => ''));
  const [erreur, setErreur] = useState<Erreur | undefined>(erreurInitiale);
  const cases = useRef<(HTMLInputElement | null)[]>([]);

  const remplir = (depuis: number, texte: string) => {
    const caracteres = texte.toUpperCase().replace(/\s/g, '').split('');
    setValeurs((avant) => {
      const apres = [...avant];
      caracteres.slice(0, CASES - depuis).forEach((c, i) => (apres[depuis + i] = c));
      return apres;
    });
    cases.current[Math.min(depuis + caracteres.length, CASES - 1)]?.focus();
  };

  const saisir = (index: number, texte: string) => {
    if (texte.length > 1) return remplir(index, texte);
    setValeurs((avant) => avant.map((v, i) => (i === index ? texte.toUpperCase() : v)));
    if (texte && index < CASES - 1) cases.current[index + 1]?.focus();
  };

  const touche = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !valeurs[index] && index > 0) cases.current[index - 1]?.focus();
  };

  const coller = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    remplir(index, e.clipboardData.getData('text'));
  };

  const valider = (e: FormEvent) => {
    e.preventDefault();
    const brut = valeurs.join('');
    const code = normaliserCode(brut);
    if (!code) {
      setErreur(brut.length < CASES ? 'codeIncomplet' : 'codeInconnu');
      cases.current[valeurs.findIndex((v) => !v)]?.focus();
      return;
    }
    router.push(`/${code}`);
  };

  return (
    <Cadre>
      <form className="tu-player__body" onSubmit={valider} noValidate>
        <h1 className="tu-player__title">{t('titre')}</h1>
        <p className="tu-player__lead">{t('aide')}</p>
        <fieldset className="tu-code-input">
          <legend className="tu-visually-hidden">{t('legende')}</legend>
          {valeurs.map((valeur, i) => (
            <input
              key={i}
              ref={(el) => {
                cases.current[i] = el;
              }}
              className="tu-code-input__slot"
              value={valeur}
              onChange={(e) => saisir(i, e.target.value)}
              onKeyDown={(e) => touche(i, e)}
              onPaste={(e) => coller(i, e)}
              aria-label={t('caractere', { n: i + 1 })}
              aria-invalid={erreur !== undefined}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={CASES}
            />
          ))}
        </fieldset>
        {erreur && (
          <p className="tu-player__error" role="alert">
            {t(erreur)}
          </p>
        )}
        <div className="tu-player__actions">
          <Button type="submit" variant="accent" size="lg" block>
            {t('bouton')}
          </Button>
        </div>
      </form>
    </Cadre>
  );
}
