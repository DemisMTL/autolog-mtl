import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Percorsi sempre permessi
  const isAuthRoute = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login";

  // Endpoint server-to-server protetto da API key (App-Ticket → Autolog-MTL)
  const isCollaudoEndpoint = pathname === "/api/records/collaudo";

  if (isAuthRoute || isCollaudoEndpoint) {
    return NextResponse.next();
  }

  // Se l'utente è già loggato e prova ad andare alla pagina di login → rimanda alla home
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  // Utente non autenticato
  if (!isLoggedIn) {
    if (isLoginPage) return NextResponse.next();

    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Utente autenticato: verifica che gli utenti USER abbiano ancora accesso abilitato.
  // ADMIN e MASTER hanno sempre accesso.
  const user = req.auth?.user as any;
  if (user?.role === "USER" && user?.autologEnabled === false) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Accesso ad Autolog non autorizzato" }, { status: 403 });
    }
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("error", "AccessDisabled");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Esclude i file statici di Next.js e favicon dall'autenticazione
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
