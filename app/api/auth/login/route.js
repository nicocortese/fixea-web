import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  signSession,
} from "@/lib/auth";
import {
  USERS_COLLECTION,
  parseLoginInput,
  toPublicUser,
} from "@/models/User";

const INVALID_CREDENTIALS_ERROR = "Email o contraseña incorrectos";

// Hash de una contraseña descartable: cuando el email no existe corremos igual
// un bcrypt.compare para no filtrar por tiempo qué cuentas están registradas.
const DUMMY_PASSWORD_HASH =
  "$2b$10$4LT7LENFQhjpEJ0dQSx8OuFky.1nwhS3BVmma3NsL9KiABk2IV9sm";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseLoginInput(body);

    if (parsed.error) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const user = await db
      .collection(USERS_COLLECTION)
      .findOne({ email: parsed.value.email });

    if (!user) {
      await bcrypt.compare(parsed.value.password, DUMMY_PASSWORD_HASH);
      // Sólo en la terminal de desarrollo: la respuesta sigue siendo genérica.
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[auth] login rechazado: no existe "${parsed.value.email}" en la base "${process.env.MONGODB_DB || "fixea"}"`,
        );
      }
      return NextResponse.json(
        { success: false, error: INVALID_CREDENTIALS_ERROR },
        { status: 401 },
      );
    }

    const validPassword = await bcrypt.compare(
      parsed.value.password,
      user.password,
    );

    if (!validPassword) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[auth] login rechazado: la contraseña no coincide para "${parsed.value.email}"`,
        );
      }
      return NextResponse.json(
        { success: false, error: INVALID_CREDENTIALS_ERROR },
        { status: 401 },
      );
    }

    const publicUser = toPublicUser(user);
    const token = await signSession({
      userId: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
    });

    const response = NextResponse.json(
      { success: true, user: publicUser },
      { status: 200 },
    );

    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Error en POST /api/auth/login:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo iniciar sesión" },
      { status: 500 },
    );
  }
}
