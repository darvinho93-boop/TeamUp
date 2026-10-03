/**
 * Export de fin de soirée (lot 10) : les scores en CSV, les photos en ZIP. Fonctions pures ; les
 * routes `/regie/[code]/export/…` lisent la base et les appellent.
 */

/** Un CSV qu'Excel ouvre tel quel en français : point-virgule, BOM UTF-8, fins de ligne CRLF. */
const SEPARATEUR = ';';
const BOM = String.fromCharCode(0xfeff);

function champ(valeur: string | number): string {
  const texte = String(valeur);
  return /[;"\r\n]/.test(texte) ? `"${texte.replaceAll('"', '""')}"` : texte;
}

const ligne = (valeurs: (string | number)[]) => valeurs.map(champ).join(SEPARATEUR);

/** Rangs « à l'olympique » : deux équipes à égalité partagent le rang, la suivante saute. */
export function rangs(points: readonly number[]): number[] {
  return points.map((p) => 1 + points.filter((autre) => autre > p).length);
}

export interface ExportScores {
  classement: { nom: string; points: number }[];
  journal: { heure: string; jeu: string; motif: string; equipe: string; points: number }[];
  libelles: {
    classement: string;
    rang: string;
    equipe: string;
    points: string;
    journal: string;
    heure: string;
    jeu: string;
    motif: string;
  };
}

/** Le classement (trié par points décroissants), puis le journal des points dans l'ordre. */
export function csvScores({ classement, journal, libelles: l }: ExportScores): string {
  const tri = [...classement].sort((a, b) => b.points - a.points);
  const r = rangs(tri.map((e) => e.points));
  const lignes = [
    ligne([l.classement]),
    ligne([l.rang, l.equipe, l.points]),
    ...tri.map((e, i) => ligne([r[i]!, e.nom, e.points])),
    '',
    ligne([l.journal]),
    ligne([l.heure, l.jeu, l.motif, l.equipe, l.points]),
    ...journal.map((s) => ligne([s.heure, s.jeu, s.motif, s.equipe, s.points])),
  ];
  return BOM + lignes.join('\r\n') + '\r\n';
}

/**
 * Un nom de fichier sûr partout (Windows compris) : sans accents, sans caractères réservés.
 * Une écriture non latine (tamoul) ne laisse rien : `secours` prend alors la place.
 */
export function nomSur(texte: string, secours: string, longueurMax = 60): string {
  const nom = texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, longueurMax)
    .replace(/-+$/, '');
  return nom || secours;
}

export interface PhotoAExporter {
  /** Ordre du thème dans la manche, à partir de 1. */
  ordreTheme: number;
  theme: string;
  equipeNumero: number;
  equipeNom: string;
  gagnante: boolean;
}

/** `01-Toute-l-equipe/Equipe-2-Corail-gagnante.jpg` : un dossier par thème, dans l'ordre. */
export function cheminDansLeZip(p: PhotoAExporter): string {
  const dossier = `${String(p.ordreTheme).padStart(2, '0')}-${nomSur(p.theme, `theme-${p.ordreTheme}`)}`;
  const fichier = `Equipe-${p.equipeNumero}-${nomSur(p.equipeNom, String(p.equipeNumero))}`;
  return `${dossier}/${fichier}${p.gagnante ? '-gagnante' : ''}.jpg`;
}
