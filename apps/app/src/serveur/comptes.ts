import 'server-only';
import type { ClientAnimateur } from './supabase-animateur';
import { supabaseService } from './supabase';

export interface NouveauCompte {
  nom: string;
  email: string;
  motDePasse: string;
  role: 'animateur' | 'admin';
}

export type ResultatCompte = { ok: true } | { ok: false; raison: 'existe' | 'echec' };

/**
 * Crée le compte d'un animateur, au nom d'un admin déjà vérifié (`exigerAdmin`).
 *
 * L'utilisateur Auth ne peut naître que du rôle de service : c'est son seul usage dans le
 * back-office. La fiche `animateurs`, elle, s'écrit sous la session de l'admin, donc sous la
 * RLS du lot 3. Si elle échoue, l'utilisateur Auth est retiré : pas de compte à moitié créé.
 */
export async function creerCompte(
  admin: ClientAnimateur,
  compte: NouveauCompte,
): Promise<ResultatCompte> {
  const service = supabaseService();
  const { data, error } = await service.auth.admin.createUser({
    email: compte.email,
    password: compte.motDePasse,
    // Pas d'e-mail de confirmation (tranché le 2026-10-03) : l'admin transmet le mot de passe.
    email_confirm: true,
  });
  if (error) {
    return { ok: false, raison: error.code === 'email_exists' ? 'existe' : 'echec' };
  }

  const { error: fiche } = await admin
    .from('animateurs')
    .insert({ id: data.user.id, nom: compte.nom, role: compte.role });
  if (fiche) {
    await service.auth.admin.deleteUser(data.user.id);
    return { ok: false, raison: 'echec' };
  }
  return { ok: true };
}
