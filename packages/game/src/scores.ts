/** Points gagnés, indexés par numéro d'équipe (1 à 8) : une ligne du journal `scores` par entrée. */
export type ScoresParEquipe = Record<number, number>;

export function verifierEntierPositif(valeur: number, nom: string): void {
  if (!Number.isInteger(valeur) || valeur < 0) {
    throw new RangeError(`${nom} doit être un entier positif ou nul (reçu : ${valeur}).`);
  }
}
