import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Le schéma n'est pas encore typé (`pnpm db:types` viendra avec les premiers écrans) :
// un schéma ouvert suffit ici, et chaque lecture annonce son type sur place.
type Ligne = Record<string, unknown>;
interface Schema {
  Tables: Record<string, { Row: Ligne; Insert: Ligne; Update: Ligne; Relationships: [] }>;
  Views: Record<string, { Row: Ligne; Relationships: [] }>;
  Functions: Record<string, { Args: Ligne; Returns: unknown }>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
}
type Base = { public: Schema };
type Client = ReturnType<typeof creer>;

const creer = (url: string, cle: string) =>
  createClient<Base>(url, cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * Accès à la base locale pour les tests.
 *
 * Les clés du stack local sont lues dans l'environnement, sinon demandées au CLI. Sans base
 * joignable, les tests qui en dépendent s'annoncent ignorés : on ne fait pas passer une suite
 * pour verte alors qu'elle n'a rien vérifié (la CI, elle, en démarre une).
 */
export interface Acces {
  url: string;
  anon: string;
  service: string;
}

function depuisLeCli(): Acces | null {
  try {
    const sortie = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      // Le CLI se lance depuis la racine du dépôt, où vit supabase/.
      cwd: fileURLToPath(new URL('../../..', import.meta.url)),
      shell: process.platform === 'win32',
    });
    const lire = (cle: string) =>
      sortie.match(new RegExp(`^${cle}="?([^"\\r\\n]+)"?$`, 'm'))?.[1] ?? '';

    const url = lire('API_URL');
    const anon = lire('ANON_KEY');
    const service = lire('SERVICE_ROLE_KEY');
    return url && anon && service ? { url, anon, service } : null;
  } catch {
    return null;
  }
}

export const acces: Acces | null =
  process.env['SUPABASE_URL'] && process.env['SUPABASE_ANON_KEY']
    ? {
        url: process.env['SUPABASE_URL'],
        anon: process.env['SUPABASE_ANON_KEY'],
        service: process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
      }
    : depuisLeCli();

export const baseDisponible = acces !== null;

/** Client sans aucun droit : c'est la place d'un curieux, pas celle d'un joueur. */
export function clientAnon(): Client {
  return creer(acces!.url, acces!.anon);
}

/** Client du serveur de l'app : le seul à pouvoir appeler les fonctions joueur. */
export function clientService(): Client {
  return creer(acces!.url, acces!.service);
}

/** Client d'un animateur connecté. */
export async function clientAnimateur(email: string): Promise<Client> {
  const client = creer(acces!.url, acces!.anon);
  const { error } = await client.auth.signInWithPassword({ email, password: 'motdepasse' });
  if (error) throw new Error(`connexion impossible pour ${email} : ${error.message}`);
  return client;
}

/**
 * Appel d'une fonction SQL avec un type de retour explicite : tant que la base n'existe pas,
 * `supabase gen types` n'a rien à générer, donc on annonce ici ce qu'on attend.
 */
export async function appeler<T>(
  client: Client,
  fonction: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; erreur: string | null }> {
  const reponse = (await client.rpc(fonction, args)) as {
    data: unknown;
    error: { message: string } | null;
  };
  return { data: (reponse.data ?? null) as T | null, erreur: reponse.error?.message ?? null };
}

/** Le jeton du joueur n'existe qu'en clair côté cookie : la base n'en voit que le SHA-256. */
export function hacher(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ANNA = '22222222-2222-4222-8222-222222222222';

/**
 * Un événement jetable, en cours, animé par Anna : les tests qui font entrer des joueurs
 * ne salissent pas la démo. `supprimerEvenements` l'efface avec ses équipes et joueurs.
 */
export async function creerEvenementJetable(
  options: { equipes?: number; langues?: string[]; expire?: boolean } = {},
): Promise<{ id: string; code: string }> {
  const service = clientService();
  const code = Array.from(randomBytes(6), (o) => ALPHABET_CODE[o % ALPHABET_CODE.length]).join('');
  const { data, error } = await service
    .from('evenements')
    .insert({
      code,
      animateur_id: ANNA,
      client_nom: 'Test automatisé',
      date_evenement: new Date().toISOString().slice(0, 10),
      creneau_minutes: 40,
      langues: options.langues ?? ['fr', 'en'],
      statut: 'en_cours',
      code_expire_le: options.expire ? new Date(Date.now() - 60_000).toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string }).id;

  const equipes = Array.from({ length: options.equipes ?? 0 }, (_, i) => ({
    evenement_id: id,
    numero: i + 1,
    nom: `Équipe ${i + 1}`,
  }));
  if (equipes.length) {
    const { error: e } = await service.from('equipes').insert(equipes);
    if (e) throw new Error(e.message);
  }
  return { id, code };
}

export async function supprimerEvenements(ids: string[]): Promise<void> {
  if (ids.length) await clientService().from('evenements').delete().in('id', ids);
}

/** Tables de l'app : aucune n'est lisible sans compte. */
export const TABLES = [
  'animateurs',
  'evenements',
  'equipes',
  'joueurs',
  'jeux',
  'manches',
  'passages',
  'scores',
  'contenus',
  'contenus_traductions',
  'contenus_secrets',
  'photos',
  'reponses_quiz',
  'classement',
] as const;
