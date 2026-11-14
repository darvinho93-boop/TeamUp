import { crc32, deflateSync } from 'node:zlib';

/**
 * Un vrai PNG RGBA pour les tests du logo partenaire : fond transparent, rectangles pleins en
 * marine. Écrit à la main (signature, IHDR, IDAT, IEND) : aucune dépendance d'image dans l'app.
 */
export function fabriquerPng(
  largeur: number,
  hauteur: number,
  pleins: { x: number; y: number; l: number; h: number }[],
): Buffer {
  // Une ligne = un octet de filtre (0 : aucun), puis quatre octets par pixel.
  const lignes = Buffer.alloc(hauteur * (1 + largeur * 4));
  for (const { x, y, l, h } of pleins) {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + l; i++) {
        lignes.set([0x1b, 0x2a, 0x4a, 0xff], j * (1 + largeur * 4) + 1 + i * 4);
      }
    }
  }
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete.set([8, 6, 0, 0, 0], 8); // 8 bits par canal, RGBA, sans entrelacement

  const bloc = (type: string, donnees: Buffer) => {
    const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
    const taille = Buffer.alloc(4);
    taille.writeUInt32BE(donnees.length);
    const controle = Buffer.alloc(4);
    controle.writeUInt32BE(crc32(corps));
    return Buffer.concat([taille, corps, controle]);
  };

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(lignes)),
    bloc('IEND', Buffer.alloc(0)),
  ]);
}
