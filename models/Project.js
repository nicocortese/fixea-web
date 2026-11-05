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

export function toPublicProject(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id || doc.id),
    name: doc.name || "",
    clientName: doc.clientName || "",
    targetUrl: doc.targetUrl || "",
    status: doc.status || "active",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.models.Project || mongoose.model("Project", ProjectSchema);