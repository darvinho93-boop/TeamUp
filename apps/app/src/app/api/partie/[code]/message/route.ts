import { z } from 'zod';
import { MESSAGE_MAX } from '@/lib/messages';
import { normaliserCode } from '@/lib/partie';
import { envoyerMessage } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';

// Large ici (émojis comptés en double par JavaScript) : la base tranche au caractère près.
const Message = z.object({
  texte: z
    .string()
    .min(1)
    .max(MESSAGE_MAX * 4),
});

const STATUT = { session: 401, fermes: 403, termine: 409, message: 422, cadence: 429 } as const;

/** Un joueur écrit sur le grand écran (2026-11-15). */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/message'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'session' }, 401);

  const saisie = Message.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'message' }, 422);

  const resultat = await envoyerMessage(code, saisie.data.texte);
  return resultat.ok
    ? reponse({ ok: true })
    : reponse(
        { erreur: resultat.refus, attente_s: resultat.attenteS ?? null },
        STATUT[resultat.refus],
      );
}
