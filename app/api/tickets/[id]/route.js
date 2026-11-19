import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { USERS_COLLECTION } from "@/models/User";
import { authorizeProjectAccess, toObjectId } from "@/lib/projectAccess";
import { EXTENSION_CORS_HEADERS, withHeaders } from "@/lib/cors";
import { PROJECTS_COLLECTION } from "@/models/Project";

// Puede tocar el ticket quien sea dueño o colaborador de SU proyecto (sesión
// web) o presente la Key de ese proyecto (la extensión del cliente). Una
// sesión de otro proyecto no alcanza.
async function authorizeTicketAccess(request, db, id, body) {
  const owner = await db
    .collection("tickets")
    .findOne(buildTicketQuery(id), { projection: { projectId: 1 } });

  if (!owner) {
    return NextResponse.json(
      { success: false, error: "Ticket no encontrado" },
      { status: 404 },
    );
  }

  const access = await authorizeProjectAccess(
    request,
    db,
    owner.projectId ? String(owner.projectId) : "",
    body,
  );

  return access.ok
    ? null
    : NextResponse.json(
        { success: false, error: access.error },
        { status: access.status },
      );
}

const VALID_STATUSES = ["PENDIENTE", "EN_PROCESO", "FINALIZADO"];

const DEVELOPER_ROLES = ["dev", "developer", "admin", "programador"];

function isDeveloperRole(role) {
  return DEVELOPER_ROLES.includes(String(role || "").trim().toLowerCase());
}

function displayName(user) {
  const name = typeof user?.name === "string" ? user.name.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  return name || email || "";
}

// Nombre del cliente del proyecto (dueño o colaborador con rol client). Se
// usa cuando quien aprueba desde la extensión arrastra la cookie del
// programador (mismo navegador): la aprobación es siempre del cliente.
async function findProjectClientName(db, projectId) {
  const projectObjectId = toObjectId(projectId);
  if (!projectObjectId) return "";

  const project = await db
    .collection(PROJECTS_COLLECTION)
    .findOne(
      { _id: projectObjectId },
      { projection: { ownerId: 1, userId: 1, collaborators: 1 } },
    );
  if (!project) return "";

  const memberIds = [
    project.ownerId,
    project.userId,
    ...(Array.isArray(project.collaborators) ? project.collaborators : []),
  ]
    .map((value) => toObjectId(value))
    .filter(Boolean);
  if (memberIds.length === 0) return "";

  const members = await db
    .collection(USERS_COLLECTION)
    .find(
      { _id: { $in: memberIds } },
      { projection: { name: 1, email: 1, role: 1 } },
    )
    .toArray();

  const client = members.find(
    (member) => !isDeveloperRole(member.role) && displayName(member),
  );
  return displayName(client);
}

/**
 * Flujo de estados del ticket:
 * - PENDIENTE  -> lo crea el cliente.
 * - EN_PROCESO -> lo toma el programador y deja la nota técnica.
 * - FINALIZADO -> el cliente verifica y aprueba la corrección.
 *
 * Un ticket no puede saltear EN_PROCESO: solo se finaliza lo que el
 * programador ya corrigió. Rechazar (PENDIENTE) y reabrir un finalizado
 * siguen permitidos.
 */
const STATUS_TRANSITIONS = {
  PENDIENTE: ["EN_PROCESO"],
  EN_PROCESO: ["FINALIZADO", "PENDIENTE"],
  FINALIZADO: ["PENDIENTE"],
};

/**
 * Builds a query that matches either a MongoDB ObjectId or a numeric/string
 * business id. This keeps the API compatible with tickets created by POST,
 * which stores `id` as Date.now() (number).
 */
function buildTicketQuery(rawId) {
  const id = String(rawId);
  const conditions = [{ id }];

  const numericId = Number(id);
  if (Number.isSafeInteger(numericId) && String(numericId) === id) {
    conditions.push({ id: numericId });
  }

  if (/^[a-fA-F0-9]{24}$/.test(id) && ObjectId.isValid(id)) {
    conditions.push({ _id: new ObjectId(id) });
  }

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

async function patchTicket(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Falta el ID del ticket" },
        { status: 400 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "El cuerpo de la petición no es JSON válido" },
        { status: 400 },
      );
    }

    const hasStatus = body?.status !== undefined;
    const hasDevNote = body?.devNote !== undefined;

    if (!hasStatus && !hasDevNote) {
      return NextResponse.json(
        {
          success: false,
          error: "Nada para actualizar. Enviá al menos status o devNote",
        },
        { status: 400 },
      );
    }

    const updates = {};

    if (hasStatus) {
      const status =
        typeof body.status === "string" ? body.status.trim().toUpperCase() : "";

      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(", ")}`,
          },
          { status: 400 },
        );
      }

      updates.status = status;
    }

    if (hasDevNote) {
      if (typeof body.devNote !== "string") {
        return NextResponse.json(
          { success: false, error: "devNote debe ser un texto" },
          { status: 400 },
        );
      }

      updates.devNote = body.devNote.trim().slice(0, 2000);
    }

    updates.updatedAt = new Date();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const tickets = db.collection("tickets");

    const denied = await authorizeTicketAccess(request, db, id, body);
    if (denied) return denied;

    if (hasStatus) {
      const existing = await tickets.findOne(buildTicketQuery(id), {
        projection: { status: 1, author: 1, projectId: 1 },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: "Ticket no encontrado" },
          { status: 404 },
        );
      }

      const currentStatus = existing.status || "PENDIENTE";
      const allowed = STATUS_TRANSITIONS[currentStatus] || [];

      // Permitimos reenviar el mismo estado (PATCH idempotente), pero nunca
      // una transición que rompa el flujo cliente <-> programador.
      if (updates.status !== currentStatus && !allowed.includes(updates.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Transición inválida: ${currentStatus} → ${updates.status}. Permitidas desde ${currentStatus}: ${allowed.join(", ") || "ninguna"}`,
          },
          { status: 409 },
        );
      }

      if (updates.status === "FINALIZADO") {
        const session = await verifySession(
          request.cookies.get(SESSION_COOKIE)?.value,
        );

        // Auditoría de la verificación del cliente: guardamos quién cerró el
        // ticket y cuándo, para que el cierre quede trazable en Mongo.
        updates.verifiedAt = new Date();
        updates.verifiedBy = session?.userId ?? null;
        updates.verifiedByName = null;

        // La aprobación es del cliente. Si la cookie es de un programador
        // (ambos roles probados en el mismo navegador), no se usa su nombre.
        let sessionName = "";
        let sessionIsDeveloper = false;

        if (session?.userId) {
          try {
            const verifier = await db
              .collection(USERS_COLLECTION)
              .findOne(
                { _id: new ObjectId(session.userId) },
                { projection: { name: 1, email: 1, role: 1 } },
              );

            sessionIsDeveloper = isDeveloperRole(verifier?.role ?? session.role);
            sessionName = displayName(verifier) || session.email || "";
          } catch (lookupError) {
            // Si la búsqueda del usuario falla, no bloqueamos el cierre.
            console.error(
              "No se pudo resolver el nombre del verificador:",
              lookupError,
            );
            sessionIsDeveloper = isDeveloperRole(session.role);
            sessionName = session.email || "";
          }
        }

        if (sessionName && !sessionIsDeveloper) {
          updates.verifiedByName = sessionName;
        } else {
          if (sessionIsDeveloper) updates.verifiedBy = null;

          let clientName = "";
          try {
            clientName = await findProjectClientName(db, existing.projectId);
          } catch (lookupError) {
            console.error("No se pudo resolver el cliente del proyecto:", lookupError);
          }

          // Nombre que manda la extensión (descartado si es el del programador).
          const bodyName =
            typeof body?.verifiedByName === "string"
              ? body.verifiedByName.trim().slice(0, 120)
              : "";
          const safeBodyName =
            bodyName &&
            !(sessionIsDeveloper && bodyName.toLowerCase() === sessionName.toLowerCase())
              ? bodyName
              : "";

          updates.verifiedByName =
            clientName ||
            safeBodyName ||
            (typeof existing.author === "string" ? existing.author.trim() : "") ||
            null;
        }
      } else {
        // Una corrección rechazada o reabierta deja de estar verificada.
        updates.verifiedAt = null;
        updates.verifiedBy = null;
        updates.verifiedByName = null;
      }
    }

    const updatedTicket = await tickets.findOneAndUpdate(
      buildTicketQuery(id),
      { $set: updates },
      { returnDocument: "after" },
    );

    if (!updatedTicket) {
      return NextResponse.json(
        { success: false, error: "Ticket no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, ticket: updatedTicket },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en PATCH /api/tickets/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar el estado del ticket" },
      { status: 500 },
    );
  }
}

async function deleteTicket(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Falta el ID del ticket" },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    const denied = await authorizeTicketAccess(request, db, id, null);
    if (denied) return denied;

    const result = await db
      .collection("tickets")
      .deleteOne(buildTicketQuery(id));

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Ticket no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Ticket eliminado correctamente" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en DELETE /api/tickets/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error al borrar el ticket" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}

export const PATCH = withHeaders(patchTicket, EXTENSION_CORS_HEADERS);
export const DELETE = withHeaders(deleteTicket, EXTENSION_CORS_HEADERS);
