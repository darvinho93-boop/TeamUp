'use client';

import { useEffect, useState } from 'react';
import { cx, Wordmark } from '@teamup/ui/react';
import { BANDEAU_MAX, BULLES_MAX, bullesA, bullesEnCours, type MessageSalle } from '@/lib/messages';
import { Pictogramme } from '@/marque/Pictogramme';

/** Le pas de redessin tant qu'une bulle est à l'écran ou en file. */
const PAS_MS = 250;

/**
 * Les messages sur le grand écran (2026-11-15) : des bulles en bas à droite, par-dessus toutes les
 * scènes. Le planning (`bullesA`) se lit à l'heure de la base : deux écrans montrent les mêmes
 * bulles, un rechargement retombe au même endroit. Rien au premier rendu (le serveur n'a pas
 * l'heure du navigateur : sinon, erreur d'hydratation).
 *
 * `bandeau` (pendant le quiz, dont les cases remplissent la scène) : une bulle à la fois, sur une
 * ligne, dans la marge du bas ; rien des cases n'est caché.
 */
export function Bulles({
  messages,
  decalageMs,
  bandeau = false,
}: {
  messages: readonly MessageSalle[];
  decalageMs: number;
  bandeau?: boolean;
}) {
  const [maintenant, setMaintenant] = useState<number | null>(null);
  const nombre = bandeau ? BANDEAU_MAX : BULLES_MAX;

  useEffect(() => {
    // Un pas tout de suite (hors du rendu de l'effet), puis tant qu'une bulle est à l'écran ou
    // en file ; une nouvelle liste (relecture) relance le tout.
    const pas = () => {
      const t = Date.now() + decalageMs;
      setMaintenant(t);
      if (!bullesEnCours(messages, t, nombre)) clearInterval(minuterie);
    };
    const premier = setTimeout(pas, 0);
    const minuterie = setInterval(pas, PAS_MS);
    return () => {
      clearTimeout(premier);
      clearInterval(minuterie);
    };
  }, [messages, decalageMs, nombre]);

  if (maintenant === null) return null;
  const bulles = bullesA(messages, maintenant, nombre);
  if (bulles.length === 0) return null;

  return (
    <ol
      className={cx('tu-bulles', bandeau && 'tu-bulles--bandeau')}
      aria-live="polite"
      data-testid="bulles"
    >
      {bulles.map(({ message, sortie }) => (
        <li
          key={message.id}
          className={cx(
            'tu-bulle',
            message.regie
              ? 'tu-bulle--regie'
              : message.equipe
                ? `tu-team--${message.equipe}`
                : null,
            sortie && 'tu-bulle--sortie',
          )}
          data-testid="bulle"
        >
          <span className="tu-bulle__auteur">
            {message.regie ? (
              <>
                <Pictogramme />
                <Wordmark />
              </>
            ) : (
              <>
                {message.equipe ? <span className="tu-team__dot" aria-hidden /> : null}
                {message.prenom}
              </>
            )}
          </span>
          <span className="tu-bulle__texte">{message.texte}</span>
        </li>
      ))}
    </ol>
  );
}
