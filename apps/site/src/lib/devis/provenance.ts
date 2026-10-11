/**
 * D'où vient une demande de devis : le lien partagé qui a amené le visiteur (`via`) et la page
 * d'où il a ouvert le formulaire (`depuis`). Rien n'est stocké chez le visiteur : les deux
 * voyagent dans l'adresse, puis dans le formulaire, et ne servent qu'à l'e-mail que reçoit
 * l'équipe. Ce sont des mots choisis par le site, jamais du texte libre.
 */
export interface Provenance {
  via?: string | undefined;
  depuis?: string | undefined;
}

/** Une étiquette courte : minuscules, chiffres, tirets. Tout le reste est écarté. */
export const FORME_PROVENANCE = /^[a-z0-9-]{1,24}$/;

const VIA: Record<string, string> = {
  whatsapp: 'lien partagé sur WhatsApp',
  instagram: 'Instagram',
  lien: 'lien copié depuis le site',
  partage: 'partage depuis un téléphone',
};

const propre = (valeur: unknown) =>
  typeof valeur === 'string' && FORME_PROVENANCE.test(valeur) ? valeur : undefined;

/** Lit la provenance dans une adresse (`URLSearchParams`) ou un formulaire (`FormData`). */
export function provenanceDepuis(source: { get(nom: string): unknown }): Provenance {
  return { via: propre(source.get('via')), depuis: propre(source.get('depuis')) };
}

/** La ligne « Provenance » de l'e-mail de l'équipe ; rien si l'on ne sait rien. */
export function libelleProvenance({ via, depuis }: Provenance): string | undefined {
  const morceaux = [
    via ? (VIA[via] ?? via) : undefined,
    depuis ? `formulaire ouvert depuis la page « ${depuis} »` : undefined,
  ].filter(Boolean);
  return morceaux.length > 0 ? morceaux.join(' ; ') : undefined;
}
