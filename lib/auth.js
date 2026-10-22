/**
 * Utilidades de sesión seguras para el runtime Edge.
 *
 * Este módulo lo importa proxy.js, así que solo puede depender de jose y de
 * constantes: nada de next/headers, mongodb ni bcrypt.
 */

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "fixea_token";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export const HOME_BY_ROLE = {
  dev: "/",
  client: "/cliente",
};

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

const SESSION_ALGORITHM = "HS256";
const SESSION_ROLES = ["dev", "client"];
const SECRET_MIN_LENGTH = 32;

function getSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < SECRET_MIN_LENGTH) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

export async function signSession({ userId, email, role }) {
  const secret = getSecret();

  if (!secret) {
    throw new Error(
      "Falta JWT_SECRET o es demasiado corto: configurá una clave de al menos 32 caracteres",
    );
  }

  if (!userId || !email || !SESSION_ROLES.includes(role)) {
    throw new Error("No se pudo firmar la sesión: datos de usuario inválidos");
  }

  return new SignJWT({
    userId: String(userId),
    email,
    role,
  })
    .setProtectedHeader({ alg: SESSION_ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifySession(token) {
  if (!token) {
    return null;
  }

  const secret = getSecret();

  if (!secret) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [SESSION_ALGORITHM],
    });

    const userId = typeof payload.userId === "string" ? payload.userId : "";
    const email = typeof payload.email === "string" ? payload.email : "";
    const role = payload.role;

    if (!userId || !email || !SESSION_ROLES.includes(role)) {
      return null;
    }

    return { userId, email, role };
  } catch {
    return null;
  }
}
