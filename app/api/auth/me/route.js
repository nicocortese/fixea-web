import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  verifySession,
} from "@/lib/auth";
import { USERS_COLLECTION, toPublicUser } from "@/models/User";

export const dynamic = "force-dynamic";

function json(body, status) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

export async function GET(request) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = await verifySession(token);

    // Sin token o token inválido: 401 explícito para que el cliente
    // redirija al login sin quedarse esperando una respuesta.
    if (!session) {
      return json({ success: false, error: "Sesión no válida" }, 401);
    }

    let userId;

    try {
      userId = new ObjectId(session.userId);
    } catch {
      return clearSessionCookie(
        json({ success: false, error: "Sesión no válida" }, 401),
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const user = await db.collection(USERS_COLLECTION).findOne({ _id: userId });

    if (!user) {
      return clearSessionCookie(
        json({ success: false, error: "Sesión no válida" }, 401),
      );
    }

    return json({ success: true, user: toPublicUser(user) }, 200);
  } catch (error) {
    console.error("Error en GET /api/auth/me:", error);
    // Un fallo de infraestructura (Mongo caído, etc.) se informa como 500 y
    // no como sesión inválida: así el cliente puede mostrar un error con
    // reintento en lugar de expulsar al usuario al login.
    return json(
      { success: false, error: "No se pudo obtener la sesión" },
      500,
    );
  }
}
