import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/base';

export type ClientAnimateur = SupabaseClient<Database>;

/**
 * Client de l'animateur connecté, côté serveur : il porte sa session, donc la RLS du lot 3.
 * La régie ne se sert jamais du rôle de service.
 */
export async function supabaseAnimateur(): Promise<ClientAnimateur> {
  const jar = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (aPoser) => {
          try {
            for (const { name, value, options } of aPoser) jar.set(name, value, options);
          } catch {
            // Rendu d'un composant serveur : les cookies y sont en lecture seule. Le proxy
            // rafraîchit déjà la session à chaque requête, rien n'est perdu.
          }
        },
      },
    },
  );
}

/** Identifiant de l'animateur connecté, d'après son jeton vérifié localement ; `null` sans session. */
export async function identifiant(supabase: ClientAnimateur): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}

export interface Animateur {
  id: string;
  nom: string;
  role: 'animateur' | 'admin';
}

/** L'animateur connecté et actif, sinon retour à la connexion. */
export async function exigerAnimateur(): Promise<{
  supabase: ClientAnimateur;
  animateur: Animateur;
}> {
  const supabase = await supabaseAnimateur();
  const id = await identifiant(supabase);
  if (!id) redirect('/regie/connexion');
  const { data: animateur } = await supabase
    .from('animateurs')
    .select('id, nom, role')
    .eq('id', id)
    .eq('actif', true)
    .maybeSingle();
  if (!animateur) redirect('/regie/connexion?compte=inactif');
  return { supabase, animateur };
}

/**
 * Le back-office : un admin connecté et actif. Un animateur reçoit une page introuvable, qui ne
 * lui apprend rien de plus. La RLS du lot 3 reste la vraie garde.
 */
export async function exigerAdmin(): Promise<{ supabase: ClientAnimateur; animateur: Animateur }> {
  const contexte = await exigerAnimateur();
  if (contexte.animateur.role !== 'admin') notFound();
  return contexte;
}
