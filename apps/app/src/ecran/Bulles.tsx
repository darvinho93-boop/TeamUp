'use client';

import { useEffect, useState } from 'react';
import { cx, Wordmark } from '@teamup/ui/react';
import { bullesA, bullesEnCours, type MessageSalle } from '@/lib/messages';
import { Pictogramme } from '@/marque/Pictogramme';

/** Le pas de redessin tant qu'une bulle est à l'écran ou en file. */
const PAS_MS = 250;

/**
 * Les messages sur le grand écran (2026-11-15) : des bulles en bas à droite, par-dessus toutes les
 * scènes. Le planning (`bullesA`) se lit à l'heure de la base : deux écrans montrent les mêmes
 * bulles, un rechargement retombe au même endroit. Rien au premier rendu (le serveur n'a pas
 * l'heure du navigateur : sinon, erreur d'hydratation).
 */
export function Bulles({
  messages,
  decalageMs,
}: {
  messages: readonly MessageSalle[];
  decalageMs: number;
}) {
  const [maintenant, setMaintenant] = useState<number | null>(null);

  useEffect(() => {
    // Un pas tout de suite (hors du rendu de l'effet), puis tant qu'une bulle est à l'écran ou
    // en file ; une nouvelle liste (relecture) relance le tout.
    const pas = () => {
      const t = Date.now() + decalageMs;
      setMaintenant(t);
      if (!bullesEnCours(messages, t)) clearInterval(minuterie);
    };
    const premier = setTimeout(pas, 0);
    const minuterie = setInterval(pas, PAS_MS);
    return () => {
      clearTimeout(premier);
      clearInterval(minuterie);
    };
  }, [messages, decalageMs]);

  if (maintenant === null) return null;
  const bulles = bullesA(messages, maintenant);
  if (bulles.length === 0) return null;

  return (
    <ol className="tu-bulles" aria-live="polite" data-testid="bulles">
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
