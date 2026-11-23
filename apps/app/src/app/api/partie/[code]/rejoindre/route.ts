import { z } from 'zod';
import { LANGUES, normaliserCode } from '@/lib/partie';
import { etatDuJoueur, etatPourJeton, rejoindre } from '@/serveur/partie';
import { reponse } from '@/serveur/reponse';
import { jetonDeDemande, nouvelleSession } from '@/serveur/session';

const Arrivee = z.object({
  prenom: z.string().trim().min(1).max(40),
  langue: z.enum(LANGUES),
  groupe: z.uuid().nullish(),
  volontaire: z.boolean().optional(),
  /** Nom d'équipe proposé par un volontaire (lot 14). */
  nom: z.string().trim().max(24).nullish(),
  /** Tirée au hasard par le téléphone : un nouvel essai retrouve la fiche déjà créée. */
  demande: z
    .string()
    .regex(/^[0-9a-f]{48}$/)
    .optional(),
});

const STATUT = {
  code_inconnu: 404,
  complet: 409,
  langue: 422,
  groupe: 422,
  prenom_pris: 409,
} as const;

/**
 * Entrée dans la partie. Idempotente : un joueur qui a déjà sa session dans cette salle
 * (double appui, retour arrière) la retrouve au lieu d'en créer une seconde, et une réponse
 * perdue en route se rattrape par la même `demande`.
 */
export async function POST(req: Request, { params }: RouteContext<'/api/partie/[code]/rejoindre'>) {
  const code = normaliserCode((await params).code);
  if (!code) return reponse({ erreur: 'code_inconnu' }, 404);

  const dejaLa = await etatDuJoueur(code);
  if (dejaLa) return reponse(dejaLa);

  const saisie = Arrivee.safeParse(await req.json().catch(() => null));
  if (!saisie.success) return reponse({ erreur: 'prenom' }, 422);

  // Un formulaire d'un autre site ne peut pas envoyer ce type : il ne choisit donc pas le jeton
  // d'une session qu'il poserait ensuite sur le navigateur de sa victime.
  const enJson = req.headers.get('content-type')?.startsWith('application/json') === true;
  const jetonRepris =
    enJson && saisie.data.demande ? jetonDeDemande(code, saisie.data.demande) : undefined;
  if (jetonRepris) {
    const repris = await etatPourJeton(code, jetonRepris);
    if (repris) {
      await nouvelleSession(code, jetonRepris);
      return reponse(repris);
    }
  }

  const jeton = await nouvelleSession(code, jetonRepris);
  const { prenom, langue, groupe, volontaire, nom } = saisie.data;
  const resultat = await rejoindre(
    code,
    prenom,
    langue,
    jeton,
    groupe ?? null,
    volontaire,
    nom || null,
  );
  if (!resultat.ok) {
    // Deux envois de la même demande en même temps : le second trouve la fiche du premier.
    const concurrent =
      resultat.erreur === 'prenom_pris' && jetonRepris
        ? await etatPourJeton(code, jetonRepris)
        : null;
    if (concurrent) return reponse(concurrent);
    return reponse({ erreur: resultat.erreur }, STATUT[resultat.erreur]);
  }

  return reponse(await etatPourJeton(code, jeton));
}
