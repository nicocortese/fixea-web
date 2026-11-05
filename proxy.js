import { NextResponse } from "next/server";
import { HOME_BY_ROLE, SESSION_COOKIE, verifySession } from "@/lib/auth";

function redirectToLogin(request, pathname, search) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (pathname === "/login") {
    if (session) {
      return NextResponse.redirect(
        new URL(HOME_BY_ROLE[session.role] ?? "/", request.url),
      );
    }
    return NextResponse.next();
  }

  // Si no hay sesión y la ruta no es pública, redirigir al login
  if (!session) {
    return redirectToLogin(request, pathname, search);
  }

  // El cliente no usa el Dashboard del programador: su panel es /cliente.
  // Como ya validamos que `session` existe, es seguro leer `session.role`.
  if (pathname === "/" && session.role === "client") {
    return NextResponse.redirect(new URL("/cliente", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/cliente",
    "/cliente/:path*",
    "/rendimiento",
    "/reportes",
    "/tiempo",
  ],
};