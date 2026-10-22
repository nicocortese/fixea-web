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

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Sesión no válida" },
        { status: 401 },
      );
    }

    let userId;

    try {
      userId = new ObjectId(session.userId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Sesión no válida" },
        { status: 401 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const user = await db.collection(USERS_COLLECTION).findOne({ _id: userId });

    if (!user) {
      return clearSessionCookie(
        NextResponse.json(
          { success: false, error: "Sesión no válida" },
          { status: 401 },
        ),
      );
    }

    return NextResponse.json(
      { success: true, user: toPublicUser(user) },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en GET /api/auth/me:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo obtener la sesión" },
      { status: 500 },
    );
  }
}
