import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/base';

let client: SupabaseClient<Database> | null = null;

/**
 * Client du rôle de service. Les joueurs n'ont ni compte ni clé : c'est ce serveur qui appelle
 * les fonctions joueur à leur place, avec le SHA-256 de leur jeton. Ne sort jamais du serveur.
 */
export function supabaseService(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env['SUPABASE_URL'];
  const cle = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !cle) {
    throw new Error(
      'SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises (apps/app/.env.local).',
    );
  }
  client = createClient<Database>(url, cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
