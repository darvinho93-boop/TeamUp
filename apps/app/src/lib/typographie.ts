/**
 * La typographie française d'un contenu saisi au back-office (2026-11-19, audit « jeu télé ») :
 * une espace ordinaire avant `? ! : ;` ou `»`, ou après `«`, devient insécable. Sinon, une
 * question affichée en grand pouvait laisser son « ? » seul sur la dernière ligne. Les autres
 * langues ne changent pas ; on n'ajoute jamais d'espace qui manque.
 */
export function typographie(texte: string, langue: string): string {
  if (langue !== 'fr') return texte;
  return texte.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');
}
