'use client';

import { useState, type FormEvent } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button, cx, TextField } from '@teamup/ui/react';
import { caracteresRestants, nettoyerMessage, type MessageSalle } from '@/lib/messages';
import { supabaseNavigateur } from '@/lib/supabase-navigateur';

/**
 * Les messages sur le grand écran, à la régie (2026-11-15) : ouvrir ou fermer les envois des
 * joueurs, écrire sous « Team Up! », retirer un message (il quitte l'écran tout de suite), ou le
 * remettre après une erreur de doigt. Un appui, sans confirmation : il faut aller vite.
 * Chaque écriture se fait sous la session de l'animateur, puis le signal habituel.
 */
export function PanneauMessages({
  evenementId,
  messages,
  ouverts,
  apresEcriture,
}: {
  evenementId: string;
  messages: readonly MessageSalle[];
  ouverts: boolean;
  apresEcriture: () => Promise<void>;
}) {
  const t = useTranslations('regie.pilotage.messages');
  const format = useFormatter();
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const ecrire = async (appel: () => PromiseLike<{ error: unknown }>) => {
    const { error } = await appel();
    await apresEcriture();
    return !error;
  };

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    const propre = nettoyerMessage(texte);
    if (!propre) return setErreur(true);
    setEnvoi(true);
    setErreur(false);
    const ok = await ecrire(() =>
      supabaseNavigateur().rpc('envoyer_message_regie', {
        p_evenement: evenementId,
        p_texte: propre,
      }),
    );
    setEnvoi(false);
    if (ok) setTexte('');
    else setErreur(true);
  };

  const derniers = [...messages].reverse();
  return (
    <details className="tu-regie-messages" open data-testid="panneau-messages">
      <summary className="tu-regie__section-title">
        {t('titre', { n: messages.filter((m) => !m.retire).length })}
      </summary>
      <div className="tu-regie-messages__corps">
        <Button
          variant={ouverts ? 'primary' : 'ghost'}
          aria-pressed={ouverts}
          onClick={() =>
            void ecrire(() =>
              supabaseNavigateur().rpc('regler_messages', {
                p_evenement: evenementId,
                p_ouverts: !ouverts,
              }),
            )
          }
          data-testid="messages-ouverts"
        >
          {ouverts ? t('ouverts') : t('fermes')}
        </Button>
        <form className="tu-regie-messages__envoi" onSubmit={(e) => void envoyer(e)} noValidate>
          <TextField
            label={t('champ')}
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value);
              setErreur(false);
            }}
            autoComplete="off"
            hint={t('restants', { n: Math.max(0, caracteresRestants(texte)) })}
            {...(erreur ? { error: t('erreur') } : {})}
          />
          <Button type="submit" disabled={envoi}>
            {t('afficher')}
          </Button>
        </form>
        {derniers.length === 0 ? (
          <p className="tu-regie__muted">{t('aucun')}</p>
        ) : (
          <ol className="tu-regie-messages__liste">
            {derniers.map((m) => (
              <li
                key={m.id}
                className={cx(
                  'tu-regie-messages__message',
                  m.retire && 'tu-regie-messages__message--retire',
                )}
                data-testid="message-regie"
              >
                <span className="tu-regie-messages__auteur">
                  {m.regie ? 'Team Up!' : m.prenom}
                  {m.equipe ? ` · ${t('equipe', { n: m.equipe })}` : ''}
                  {' · '}
                  {format.dateTime(new Date(m.cree_ms), { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="tu-regie-messages__texte">{m.texte}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void ecrire(() =>
                      supabaseNavigateur().rpc('retirer_message', {
                        p_message: m.id,
                        p_retire: !m.retire,
                      }),
                    )
                  }
                >
                  {m.retire ? t('remettre') : t('retirer')}
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
