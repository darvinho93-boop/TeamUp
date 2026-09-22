import { Resend } from 'resend';
import { emailAccuse, emailEquipe, type Email } from './emails';
import type { Demande } from './schema';

export interface ConfigEnvoi {
  /** Absente : mode « à sec », les e-mails sont écrits dans la console (dev, CI). */
  apiKey?: string | undefined;
  /** Adresse qui reçoit les demandes. */
  destinataire?: string | undefined;
  /** Expéditeur vérifié chez Resend, ex. « Team Up! <devis@teamup.fr> ». */
  expediteur?: string | undefined;
}

interface Message extends Email {
  to: string;
  replyTo?: string;
}

type Expedier = (message: Message) => Promise<void>;

/**
 * Envoie la demande à Team Up!, puis l'accusé de réception au prospect.
 * Seul le premier envoi compte : si l'accusé échoue, la demande est quand même arrivée.
 */
export async function envoyerDevis(demande: Demande, config: ConfigEnvoi): Promise<boolean> {
  const expedier = choisirExpedition(config);
  const destinataire = config.destinataire ?? '(DEVIS_DESTINATAIRE)';

  try {
    await expedier({ ...emailEquipe(demande), to: destinataire, replyTo: demande.email });
  } catch (erreur) {
    console.error("[devis] échec de l'envoi à Team Up!", erreur);
    return false;
  }

  try {
    await expedier({ ...emailAccuse(demande), to: demande.email, replyTo: destinataire });
  } catch (erreur) {
    console.error("[devis] échec de l'accusé de réception", erreur);
  }
  return true;
}

function choisirExpedition({ apiKey, destinataire, expediteur }: ConfigEnvoi): Expedier {
  if (!apiKey) {
    return (message) => {
      console.info(
        `[devis] mode à sec (RESEND_API_KEY absente)\nÀ : ${message.to}\nObjet : ${message.subject}\n\n${message.text}`,
      );
      return Promise.resolve();
    };
  }
  if (!destinataire || !expediteur) {
    return () =>
      Promise.reject(new Error('DEVIS_DESTINATAIRE et DEVIS_EXPEDITEUR sont requis avec Resend.'));
  }

  const resend = new Resend(apiKey);
  return async ({ to, replyTo, subject, text, html }) => {
    const { error } = await resend.emails.send({
      from: expediteur,
      to,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) throw new Error(`${error.name} : ${error.message}`);
  };
}
