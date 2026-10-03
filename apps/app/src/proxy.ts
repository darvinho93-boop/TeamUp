import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Régie, écran commun et back-office : réservés aux animateurs connectés. Le proxy rafraîchit la session
 * Supabase à chaque requête (les composants serveur ne peuvent pas écrire de cookie) et renvoie
 * à la connexion quand il n'y en a pas. Les pages vérifient encore le compte elles-mêmes.
 */
export async function proxy(request: NextRequest) {
  let reponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (aPoser) => {
          for (const { name, value } of aPoser) request.cookies.set(name, value);
          reponse = NextResponse.next({ request });
          for (const { name, value, options } of aPoser) reponse.cookies.set(name, value, options);
        },
      },
    },
  );

  // Jeton vérifié localement (clés de signature asymétriques) : pas d'aller-retour vers le
  // serveur d'authentification à chaque requête, ce qui compte pour la latence de la régie.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims.sub && request.nextUrl.pathname !== '/regie/connexion') {
    const connexion = request.nextUrl.clone();
    connexion.pathname = '/regie/connexion';
    connexion.search = `?suite=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(connexion);
  }
  return reponse;
}

export const config = {
  matcher: ['/regie/:path*', '/ecran/:path*', '/admin/:path*'],
};
