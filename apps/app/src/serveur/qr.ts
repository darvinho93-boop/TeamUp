import 'server-only';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import tokens from '@teamup/brand/tokens.json';

/** L'adresse publique de l'app, telle que le téléphone la joindra (`app.teamup.fr`, ou le réseau local en dev). */
export async function adresseDeLApp(): Promise<URL> {
  const configuree = process.env['NEXT_PUBLIC_APP_URL'];
  if (configuree) return new URL(configuree);
  const h = await headers();
  const hote = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const protocole = h.get('x-forwarded-proto') ?? (hote.startsWith('localhost') ? 'http' : 'https');
  return new URL(`${protocole}://${hote}`);
}

/** QR code de la partie en SVG : navy sur blanc, la marge blanche fait partie du code. */
export async function qrDeLaPartie(code: string): Promise<{ svg: string; adresse: string }> {
  const base = await adresseDeLApp();
  const url = new URL(`/${code}`, base);
  const svg = await QRCode.toString(url.toString(), {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: tokens.color.stage.bg, light: tokens.color.semantic.surface },
  });
  return { svg, adresse: base.host };
}
