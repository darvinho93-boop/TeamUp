import { timingSafeEqual } from 'node:crypto';
import { purgerCartesExpirees, purgerFondsExpires, purgerPhotosExpirees } from '@/lib/purge';
import { supabaseService } from '@/serveur/supabase';

/**
 * Purge quotidienne des photos expirées (et des photos de fond des jeux, et des cartes des joueurs), appelée par Vercel Cron (`vercel.json`). Vercel envoie
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

  const service = supabaseService();
  const supprimees = await purgerPhotosExpirees(service);
  // Les photos de fond des jeux (2026-11-15) suivent la même conservation.
  const fonds = await purgerFondsExpires(service);
  // Les cartes « Faisons connaissance » (2026-11-18) : effacées le lendemain de la soirée.
  const cartes = await purgerCartesExpirees(service);
  return Response.json({ supprimees, fonds, cartes });
}
