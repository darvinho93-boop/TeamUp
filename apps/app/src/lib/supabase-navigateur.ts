'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/base';

let client: SupabaseClient<Database> | null = null;

/**
 * Client du navigateur de l'animateur (régie, écran commun) : sa session vient des cookies
 * posés à la connexion, donc la RLS et le temps réel s'appliquent à ses seuls événements.
 * La clé anon est publique par nature et n'ouvre rien à elle seule (lot 3).
 */
export function supabaseNavigateur(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
