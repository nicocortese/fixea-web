import mongoose from "mongoose";

export const PROJECTS_COLLECTION = "projects";
export const PROJECT_STATUSES = ["active", "archived"];

const NAME_MAX = 80;
const CLIENT_NAME_MAX = 120;

export function parseProjectInput(input = {}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!name) {
    return { error: "El nombre del proyecto es obligatorio" };
  }

  if (name.length > NAME_MAX) {
    return { error: `El nombre no puede superar los ${NAME_MAX} caracteres` };
  }

  if (input.clientName !== undefined && typeof input.clientName !== "string") {
    return { error: "El cliente debe ser un texto" };
  }

  const clientName =
    typeof input.clientName === "string" ? input.clientName.trim() : "";

  if (clientName.length > CLIENT_NAME_MAX) {
    return {
      error: `El cliente no puede superar los ${CLIENT_NAME_MAX} caracteres`,
    };
  }

  if (input.targetUrl !== undefined && typeof input.targetUrl !== "string") {
    return { error: "La URL objetivo debe ser un texto" };
  }

  let targetUrl =
    typeof input.targetUrl === "string" ? input.targetUrl.trim() : "";

  if (targetUrl && !/^https?:\/\//i.test(targetUrl)) {
    targetUrl = targetUrl.includes("localhost")
      ? `http://${targetUrl}`
      : `https://${targetUrl}`;
  }

  if (input.status !== undefined && typeof input.status !== "string") {
    return { error: "El estado del proyecto es inválido" };
  }

  const status =
    typeof input.status === "string" && input.status.trim()
      ? input.status.trim()
      : "active";

  if (!PROJECT_STATUSES.includes(status)) {
    return {
      error: `Estado inválido. Valores permitidos: ${PROJECT_STATUSES.join(", ")}`,
    };
  }

  return { value: { name, clientName, targetUrl, status } };
}

// ---- Key de conexión programador -> cliente ----
// El programador comparte esta Key con su cliente; la extensión la exige para
// vincularse al proyecto y la API la valida al crear/leer tickets sin sesión.
// Alfabeto sin caracteres ambiguos (0/O, 1/I/L): 16 caracteres ≈ 80 bits.
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const KEY_PATTERN = /^FX(?:-[A-Z0-9]{4}){4}$/;

export function generateProjectKey() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => KEY_ALPHABET[b % KEY_ALPHABET.length]);
  const groups = [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join(""));
  return `FX-${groups.join("-")}`;
}

export function normalizeProjectKey(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (!compact.startsWith("FX") || compact.length !== 18) return "";
  const body = compact.slice(2);
  const key = `FX-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
  return KEY_PATTERN.test(key) ? key : "";
}

// Comparación en tiempo constante para no filtrar la Key por timing.
export function projectKeysMatch(expected, provided) {
  const a = normalizeProjectKey(expected);
  const b = normalizeProjectKey(provided);
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function toPublicProject(doc, { includeKey = false } = {}) {
  if (!doc) return null;
  const project = {
    id: String(doc._id || doc.id),
    name: doc.name || "",
    clientName: doc.clientName || "",
    targetUrl: doc.targetUrl || "",
    status: doc.status || "active",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (includeKey) project.accessKey = doc.accessKey || "";
  return project;
}

export async function ensureProjectIndexes() {
  // Función stub para no romper la llamada en las rutas API nativas de Mongo
  return true;
}

const ProjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre del proyecto es obligatorio"],
      trim: true,
    },
    clientName: {
      type: String,
      trim: true,
      default: "",
    },
    targetUrl: {
      type: String,
      required: [true, "La URL del sitio es obligatoria"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
    accessKey: {
      type: String,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.models.Project || mongoose.model("Project", ProjectSchema);