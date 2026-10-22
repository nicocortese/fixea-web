/**
 * Modelo de proyecto (driver crudo de MongoDB, sin Mongoose).
 *
 * Forma del documento:
 * - name: string (obligatorio, recortado, máximo 80 caracteres)
 * - clientName: string (opcional, recortado, máximo 120 caracteres)
 * - targetUrl: string (opcional, debe empezar con http:// o https://)
 * - status: "active" | "archived" (por defecto "active")
 * - createdAt: Date (se asigna al crear)
 */

export const PROJECTS_COLLECTION = "projects";

export const PROJECT_STATUSES = ["active", "archived"];

const NAME_MAX = 80;
const CLIENT_NAME_MAX = 120;
const URL_PATTERN = /^https?:\/\//i;

export function parseProjectInput(body) {
  const rawName = typeof body?.name === "string" ? body.name.trim() : "";

  if (!rawName) {
    return { error: "El nombre del proyecto es obligatorio" };
  }

  if (rawName.length > NAME_MAX) {
    return { error: `El nombre no puede superar los ${NAME_MAX} caracteres` };
  }

  if (body?.clientName !== undefined && typeof body.clientName !== "string") {
    return { error: "El cliente debe ser un texto" };
  }

  const clientName =
    typeof body?.clientName === "string" ? body.clientName.trim() : "";

  if (clientName.length > CLIENT_NAME_MAX) {
    return {
      error: `El cliente no puede superar los ${CLIENT_NAME_MAX} caracteres`,
    };
  }

  if (body?.targetUrl !== undefined && typeof body.targetUrl !== "string") {
    return { error: "La URL objetivo debe ser un texto" };
  }

  const targetUrl =
    typeof body?.targetUrl === "string" ? body.targetUrl.trim() : "";

  if (targetUrl && !URL_PATTERN.test(targetUrl)) {
    return { error: "La URL objetivo debe empezar con http:// o https://" };
  }

  if (body?.status !== undefined && typeof body.status !== "string") {
    return { error: "El estado del proyecto es inválido" };
  }

  const status =
    typeof body?.status === "string" && body.status.trim()
      ? body.status.trim()
      : "active";

  if (!PROJECT_STATUSES.includes(status)) {
    return {
      error: `Estado inválido. Valores permitidos: ${PROJECT_STATUSES.join(", ")}`,
    };
  }

  return {
    value: {
      name: rawName,
      clientName,
      targetUrl,
      status,
      createdAt: new Date(),
    },
  };
}

export function toPublicProject(doc) {
  return {
    ...doc,
    id: String(doc._id),
    _id: String(doc._id),
  };
}

/**
 * Índice único por nombre con collation en español (fuerza 2): "Acme" y "acme"
 * cuentan como el mismo proyecto. Se ignora el error si ya existieran
 * duplicados previos, porque en ese caso Mongo no puede crear el índice.
 */
export async function ensureProjectIndexes(db) {
  try {
    await db
      .collection(PROJECTS_COLLECTION)
      .createIndex(
        { name: 1 },
        { unique: true, collation: { locale: "es", strength: 2 } },
      );
  } catch (error) {
    console.error("No se pudo crear el índice único de proyectos:", error);
  }
}
