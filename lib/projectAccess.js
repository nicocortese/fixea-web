import { ObjectId } from "mongodb";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { PROJECTS_COLLECTION, projectKeysMatch } from "@/models/Project";

// Header con el que la extensión manda la Key del proyecto.
export const PROJECT_KEY_HEADER = "x-fixea-project-key";

export function readProjectKey(request, body) {
  const fromHeader = request.headers.get(PROJECT_KEY_HEADER) || "";
  const fromBody = typeof body?.projectKey === "string" ? body.projectKey : "";
  return (fromHeader || fromBody).trim();
}

export async function readSession(request) {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}

export function toObjectId(value) {
  const id = typeof value === "string" ? value.trim() : String(value ?? "");
  return /^[a-f0-9]{24}$/i.test(id) && ObjectId.isValid(id)
    ? new ObjectId(id)
    : null;
}

export async function findActiveProject(db, projectId) {
  const _id = toObjectId(projectId);
  if (!_id) return null;

  return db.collection(PROJECTS_COLLECTION).findOne({
    _id,
    status: { $ne: "archived" },
  });
}

// ---- Membresía: dueño (cualquier rol) o colaborador que se unió con la Key ----

export function membershipOf(project, userId) {
  const uid = String(userId || "");
  if (!project || !uid) return null;
  if (project.ownerId && String(project.ownerId) === uid) return "owner";
  const collaborators = Array.isArray(project.collaborators)
    ? project.collaborators
    : [];
  return collaborators.some((id) => String(id) === uid) ? "collaborator" : null;
}

// Filtro de Mongo: proyectos activos donde el usuario es dueño o colaborador.
export function memberProjectsFilter(userId) {
  const uid = toObjectId(userId);
  if (!uid) return null;
  return {
    status: { $ne: "archived" },
    $or: [{ ownerId: uid }, { collaborators: uid }],
  };
}

export async function memberProjectIds(db, userId) {
  const filter = memberProjectsFilter(userId);
  if (!filter) return [];
  const projects = await db
    .collection(PROJECTS_COLLECTION)
    .find(filter, { projection: { _id: 1 } })
    .toArray();
  return projects.map((project) => String(project._id));
}

/**
 * Quién puede tocar los tickets de un proyecto:
 * - un usuario logueado que sea dueño o colaborador del proyecto, o
 * - la extensión del cliente, presentando la Key del proyecto.
 * Una sesión de otro proyecto, o la URL del sitio sola, NO alcanzan.
 */
export async function authorizeProjectAccess(request, db, projectId, body) {
  const session = await readSession(request);
  const project = await findActiveProject(db, projectId);

  if (session && project && membershipOf(project, session.userId)) {
    return { ok: true, session, project, via: "session" };
  }

  const key = readProjectKey(request, body);
  if (key) {
    if (project && project.accessKey && projectKeysMatch(project.accessKey, key)) {
      return { ok: true, session, project, via: "key" };
    }
    return { ok: false, status: 403, error: "Key de proyecto inválida" };
  }

  if (session) {
    return {
      ok: false,
      status: project ? 403 : 404,
      error: project
        ? "No sos parte de este proyecto. Vinculate con su Key."
        : "Proyecto no encontrado",
    };
  }

  return {
    ok: false,
    status: 401,
    error: "Falta la Key del proyecto. Pedísela a la otra parte del proyecto.",
  };
}
