/**
 * Modelo de usuario (driver crudo de MongoDB, sin Mongoose).
 *
 * Forma del documento:
 * - email: string (obligatorio, recortado, minúsculas, único, máximo 254)
 * - password: string (obligatorio, hash bcrypt)
 * - name: string (obligatorio, recortado, entre 2 y 80 caracteres)
 * - role: "dev" | "client" (por defecto "client")
 * - createdAt: Date (se asigna al crear)
 */

export const USERS_COLLECTION = "users";

export const USER_ROLES = ["dev", "client"];

const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
const NAME_MIN = 2;
const NAME_MAX = 80;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validateEmail(email) {
  if (!email) {
    return "El email es obligatorio";
  }

  if (email.length > EMAIL_MAX) {
    return `El email no puede superar los ${EMAIL_MAX} caracteres`;
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "El email no es válido";
  }

  return null;
}

export function parseRegisterInput(body) {
  const email = normalizeEmail(body?.email);
  const emailError = validateEmail(email);

  if (emailError) {
    return { error: emailError };
  }

  if (typeof body?.password !== "string" || !body.password) {
    return { error: "La contraseña es obligatoria" };
  }

  if (body.password.length < PASSWORD_MIN) {
    return { error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` };
  }

  if (body.password.length > PASSWORD_MAX) {
    return { error: `La contraseña no puede superar los ${PASSWORD_MAX} caracteres` };
  }

  if (typeof body?.name !== "string") {
    return { error: "El nombre es obligatorio" };
  }

  const name = body.name.trim();

  if (!name) {
    return { error: "El nombre es obligatorio" };
  }

  if (name.length < NAME_MIN) {
    return { error: `El nombre debe tener al menos ${NAME_MIN} caracteres` };
  }

  if (name.length > NAME_MAX) {
    return { error: `El nombre no puede superar los ${NAME_MAX} caracteres` };
  }

  let role = "client";

  if (body?.role !== undefined && body?.role !== null && body?.role !== "") {
    if (typeof body.role !== "string") {
      return { error: "El rol es inválido" };
    }

    role = body.role.trim();

    if (!USER_ROLES.includes(role)) {
      return {
        error: `Rol inválido. Valores permitidos: ${USER_ROLES.join(", ")}`,
      };
    }
  }

  return {
    value: {
      email,
      password: body.password,
      name,
      role,
      createdAt: new Date(),
    },
  };
}

export function parseLoginInput(body) {
  const email = normalizeEmail(body?.email);

  if (!email) {
    return { error: "El email es obligatorio" };
  }

  if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    return { error: "El email no es válido" };
  }

  if (typeof body?.password !== "string" || !body.password) {
    return { error: "La contraseña es obligatoria" };
  }

  return {
    value: {
      email,
      password: body.password,
    },
  };
}

export function toPublicUser(doc) {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    createdAt: doc.createdAt,
  };
}

export async function ensureUserIndexes(db) {
  try {
    await db.collection(USERS_COLLECTION).createIndex({ email: 1 }, { unique: true });
  } catch (error) {
    console.error("No se pudo crear el índice único de usuarios:", error);
  }
}
