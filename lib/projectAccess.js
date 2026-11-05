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

export async function findActiveProject(db, projectId) {
  const id = typeof projectId === "string" ? projectId.trim() : "";
  if (!/^[a-f0-9]{24}$/i.test(id) || !ObjectId.isValid(id)) return null;

  return db.collection(PROJECTS_COLLECTION).findOne({
    _id: new ObjectId(id),
    status: { $ne: "archived" },
  });
}

/**
 * Quién puede tocar los tickets de un proyecto:
 * - un usuario logueado en la web (cookie de sesión), o
 * - la extensión del cliente, presentando la Key del proyecto.
 * Sin una de las dos, la URL del sitio sola NO alcanza.
 */
export async function authorizeProjectAccess(request, db, projectId, body) {
  const session = await readSession(request);
  if (session) return { ok: true, session, via: "session" };

  const key = readProjectKey(request, body);
  if (!key) {
    return {
      ok: false,
      status: 401,
      error: "Falta la Key del proyecto. Pedísela al programador.",
    };
  }

  const project = await findActiveProject(db, projectId);
  if (!project || !project.accessKey || !projectKeysMatch(project.accessKey, key)) {
    return { ok: false, status: 403, error: "Key de proyecto inválida" };
  }

  return { ok: true, session: null, project, via: "key" };
}
