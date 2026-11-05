import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const response = NextResponse.json(
      { success: true },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set(SESSION_COOKIE, "", {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Error en POST /api/auth/logout:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo cerrar la sesión" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
