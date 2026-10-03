import { timingSafeEqual } from 'node:crypto';
import { purgerPhotosExpirees } from '@/lib/purge';
import { supabaseService } from '@/serveur/supabase';

/**
 * Purge quotidienne des photos expirées, appelée par Vercel Cron (`vercel.json`). Vercel envoie
 * `Authorization: Bearer <CRON_SECRET>` ; sans ce secret, rien ne se passe.
 */
export async function GET(req: Request) {
  const secret = process.env['CRON_SECRET'];
  const recu = req.headers.get('authorization') ?? '';
  const attendu = `Bearer ${secret}`;
  const autorise =
    !!secret &&
    recu.length === attendu.length &&
    timingSafeEqual(Buffer.from(recu), Buffer.from(attendu));
  if (!autorise) return Response.json({ erreur: 'non autorisé' }, { status: 401 });

  const supprimees = await purgerPhotosExpirees(supabaseService());
  return Response.json({ supprimees });
}
