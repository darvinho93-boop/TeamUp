/**
 * File d'attente des photos du capitaine, dans IndexedDB : une photo prise hors réseau survit à
 * la fermeture de l'onglet et part au retour du réseau. Une entrée par salle et par thème : la
 * dernière photo prise remplace celle qui attendait encore.
 *
 * Sans IndexedDB (navigation privée de certains navigateurs), la file vit en mémoire : la
 * photo part quand même au retour du réseau, tant que la page reste ouverte.
 */

export interface EnvoiEnAttente {
  /** `<code>:<theme_id>` */
  cle: string;
  code: string;
  theme_id: string;
  /** Tiré au moment de la prise : un renvoi écrase le même fichier côté serveur. */
  envoi_id: string;
  photo: Blob;
  prise_le: number;
}

const BASE = 'teamup-photos';
const MAGASIN = 'envois';

const enMemoire = new Map<string, EnvoiEnAttente>();
let base: Promise<IDBDatabase | null> | null = null;

function ouvrir(): Promise<IDBDatabase | null> {
  base ??= new Promise((resolve) => {
    try {
      const requete = indexedDB.open(BASE, 1);
      requete.onupgradeneeded = () => requete.result.createObjectStore(MAGASIN, { keyPath: 'cle' });
      requete.onsuccess = () => resolve(requete.result);
      requete.onerror = () => resolve(null);
      requete.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return base;
}

function operation<T>(
  mode: IDBTransactionMode,
  agir: (magasin: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return ouvrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        if (!db) return reject(new Error('IndexedDB indisponible'));
        const requete = agir(db.transaction(MAGASIN, mode).objectStore(MAGASIN));
        requete.onsuccess = () => resolve(requete.result);
        requete.onerror = () => reject(requete.error ?? new Error('IndexedDB'));
      }),
  );
}

export const cleEnvoi = (code: string, themeId: string) => `${code}:${themeId}`;

export async function mettreEnFile(envoi: EnvoiEnAttente): Promise<void> {
  enMemoire.set(envoi.cle, envoi);
  await operation('readwrite', (m) => m.put(envoi)).catch(() => undefined);
}

export async function enAttente(code: string): Promise<EnvoiEnAttente[]> {
  const stockes = await operation<EnvoiEnAttente[]>(
    'readonly',
    (m) => m.getAll() as IDBRequest<EnvoiEnAttente[]>,
  ).catch(() => [] as EnvoiEnAttente[]);
  // La mémoire a le dernier mot : une écriture IndexedDB ratée n'y fait pas revenir une vieille photo.
  const tous = new Map([...stockes.map((e) => [e.cle, e] as const), ...enMemoire]);
  return [...tous.values()].filter((e) => e.code === code).sort((a, b) => a.prise_le - b.prise_le);
}

/** Retire une entrée, sauf si une photo plus récente l'a remplacée entre-temps. */
export async function retirer(envoi: EnvoiEnAttente): Promise<void> {
  const courant = (await enAttente(envoi.code)).find((e) => e.cle === envoi.cle);
  if (courant && courant.envoi_id !== envoi.envoi_id) return;
  enMemoire.delete(envoi.cle);
  await operation('readwrite', (m) => m.delete(envoi.cle)).catch(() => undefined);
}
