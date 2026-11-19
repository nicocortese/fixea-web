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
  ensureUserIndexes,
  parseRegisterInput,
  toPublicUser,
} from "@/models/User";

const DUPLICATE_EMAIL_ERROR = "Ya existe una cuenta con ese email";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseRegisterInput(body);

    if (parsed.error) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    // Ambos roles se registran solo con nombre, email y contraseña.
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const users = db.collection(USERS_COLLECTION);

    await ensureUserIndexes(db);

    const existing = await users.findOne(
      { email: parsed.value.email },
      { projection: { _id: 1 } },
    );

    if (existing) {
      return NextResponse.json(
        { success: false, error: DUPLICATE_EMAIL_ERROR },
        { status: 409 },
      );
    }

    const password = await bcrypt.hash(parsed.value.password, 10);

    const document = {
      email: parsed.value.email,
      password,
      name: parsed.value.name,
      role: parsed.value.role,
      createdAt: parsed.value.createdAt,
    };

    let result;

    try {
      result = await users.insertOne(document);
    } catch (error) {
      if (error?.code === 11000) {
        return NextResponse.json(
          { success: false, error: DUPLICATE_EMAIL_ERROR },
          { status: 409 },
        );
      }
      throw error;
    }

    const user = toPublicUser({ ...document, _id: result.insertedId });

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[auth] usuario creado: "${user.email}" (${user.role}) en la base "${process.env.MONGODB_DB || "fixea"}"`,
      );
    }
    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json(
      { success: true, user },
      { status: 201 },
    );

    response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error("Error en POST /api/auth/register:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo crear la cuenta" },
      { status: 500 },
    );
  }
}
