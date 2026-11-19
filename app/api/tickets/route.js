import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import {
  authorizeProjectAccess,
  findActiveProject,
  memberProjectIds,
  readSession,
} from "@/lib/projectAccess";
import { projectMatchesOrigin } from "@/lib/projectMatch";
import { TICKETS_COLLECTION, parseTicketMetadata } from "@/models/Ticket";

// Solo POST necesita CORS: lo consume la extensión desde chrome-extension://.
// GET queda sin CORS a propósito para que un sitio de terceros no pueda leer
// los tickets (incluidos screenshots y notas) desde el navegador del operador.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Fixea-Project-Key",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// La web usa roles "dev" / "client"; la extensión habla de "developer". En
// Mongo guardamos siempre "developer" o "client" para poder filtrar por rol.
function resolveTicketRole(session, body) {
  const candidates = [session?.role, body?.role];

  for (const candidate of candidates) {
    const role = typeof candidate === "string" ? candidate.trim().toLowerCase() : "";
    if (!role) continue;
    if (["dev", "developer", "admin", "programador"].includes(role)) {
      return "developer";
    }
    if (role === "client" || role === "cliente") {
      return "client";
    }
  }

  return null;
}

export async function GET(request) {
  try {
    // La extensión sólo necesita metadatos livianos para pintar los pines:
    // con ?compact=1 evitamos transferir screenshots (hasta 4 MB cada uno)
    // en cada refresco. El Dashboard sigue recibiendo el documento completo.
    const compact =
      new URL(request.url).searchParams.get("compact") === "1";
    const projectId = new URL(request.url).searchParams.get("projectId");

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const query = { deleted: { $ne: true } };

    if (typeof projectId === "string" && projectId.trim()) {
      query.projectId = projectId.trim();
    }

    // Con sesión: sólo los tickets de los proyectos donde el usuario es dueño
    // o colaborador (antes cualquier usuario logueado veía los de todos).
    // Sin sesión (la extensión): sólo el proyecto cuya Key se presenta.
    const session = await readSession(request);
    const requestedId = query.projectId;

    if (session) {
      const memberIds = await memberProjectIds(db, session.userId);

      if (requestedId && !memberIds.includes(requestedId)) {
        // Puede ser la extensión en el mismo navegador: vale la Key.
        const access = await authorizeProjectAccess(request, db, requestedId);
        if (!access.ok) {
          return NextResponse.json(
            { success: false, error: access.error },
            { status: access.status },
          );
        }
      } else if (!requestedId) {
        query.projectId = { $in: memberIds };
      }
    } else {
      const access = await authorizeProjectAccess(request, db, requestedId);
      if (!access.ok) {
        return NextResponse.json(
          { success: false, error: access.error },
          { status: access.status },
        );
      }
      query.projectId = String(access.project._id);
    }

    const tickets = await db
      .collection(TICKETS_COLLECTION)
      // Los tickets borrados lógicamente (deleted: true) no se listan.
      .find(
        query,
        compact ? { projection: { screenshotUrl: 0, metadata: 0 } } : {},
      )
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      { success: true, tickets },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en GET /api/tickets:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener los tickets" },
      { status: 500 },
    );
  }
}

// Keep captures below common serverless request limits (Vercel ~4.5 MB).
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

const SCREENSHOT_DATA_URL =
  /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i;
const SCREENSHOT_REMOTE_URL = /^https?:\/\/[^\s]+$/i;

function normalizeScreenshot(body) {
  const raw = body?.screenshotUrl || body?.screenshot || body?.imageUrl || null;

  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value) return null;

  return value;
}

function hasValidCoords(coords) {
  return (
    coords &&
    typeof coords === "object" &&
    Number.isFinite(Number(coords.x)) &&
    Number.isFinite(Number(coords.y))
  );
}

// La extensión postea desde el service worker: no viaja la cookie de sesión
// del dashboard y, desde que localhost:3000 está excluido del content script,
// tampoco siempre tiene la Key sincronizada. Se acepta el ticket cuando el
// projectId es de un proyecto ACTIVO cuya targetUrl coincide con la página
// donde se reportó (mismo criterio que /api/projects/match). Sólo habilita
// CREAR tickets en ese proyecto: leerlos sigue exigiendo sesión o Key.
async function authorizeBySiteMatch(db, body) {
  const pageUrl =
    typeof body?.pageUrl === "string" && body.pageUrl.trim()
      ? body.pageUrl.trim()
      : typeof body?.url === "string"
        ? body.url.trim()
        : "";
  if (!pageUrl) return null;

  let current;
  try {
    current = new URL(pageUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(current.protocol)) return null;

  const project = await findActiveProject(db, body?.projectId);
  if (!project || !projectMatchesOrigin(project.targetUrl, current)) {
    return null;
  }

  return { ok: true, session: null, project, via: "site" };
}

export async function POST(request) {
  try {
    const body = await request.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";

    if (!title || !hasValidCoords(body?.coords)) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan datos obligatorios (título o coordenadas)",
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const screenshotUrl = normalizeScreenshot(body);

    if (
      screenshotUrl &&
      !SCREENSHOT_DATA_URL.test(screenshotUrl) &&
      !SCREENSHOT_REMOTE_URL.test(screenshotUrl)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "El screenshot debe ser una imagen data URL o una URL http(s)",
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (screenshotUrl && screenshotUrl.length > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "El screenshot supera el tamaño máximo permitido (4 MB)",
        },
        { status: 413, headers: CORS_HEADERS },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    // Sesión web o Key del proyecto: la URL del sitio sola no habilita a
    // crear tickets (evita que cualquiera inyecte reportes en un proyecto).
    let access = await authorizeProjectAccess(
      request,
      db,
      body?.projectId,
      body,
    );

    // Sin sesión del proyecto ni Key válida: vale el match proyecto <-> sitio.
    if (!access.ok && (access.status === 401 || access.status === 403)) {
      const bySite = await authorizeBySiteMatch(db, body);
      if (bySite) access = bySite;
    }

    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error },
        { status: access.status, headers: CORS_HEADERS },
      );
    }

    // `createdBy` guarda el id del usuario autenticado. La cookie firmada es
    // la fuente de verdad: el body solo se usa cuando no hay sesión (la
    // extensión postea sin cookies). Nunca se guarda un objeto arbitrario.
    const session = access.session;
    const bodyCreatedBy =
      typeof body.createdBy === "string"
        ? body.createdBy.trim().slice(0, 64)
        : "";
    const createdBy = session?.userId || bodyCreatedBy || null;

    const newTicketData = {
      id: body.id || Date.now(),
      number: body.number ?? null,
      type: body.type || null,
      color: body.color || null,
      shape: body.shape || null,
      // Con Key, el proyecto sale de la base (no del body).
      project: access.project
        ? access.project.name || "Sin proyecto"
        : typeof body.project === "string" && body.project.trim()
          ? body.project.trim()
          : "Sin proyecto",
      projectId: access.project
        ? String(access.project._id)
        : typeof body.projectId === "string" && body.projectId.trim()
          ? body.projectId.trim()
          : null,
      title,
      priority: body.priority || "Alta",
      status: body.status || "PENDIENTE",
      author:
        typeof body.author === "string" && body.author.trim()
          ? body.author.trim()
          : "Cliente",
      coords: body.coords,
      metadata: parseTicketMetadata(body.metadata),
      role: resolveTicketRole(session, body),
      createdBy,
      userId: createdBy,
      url: body.url || null,
      pageUrl:
        typeof body.pageUrl === "string" && body.pageUrl.trim()
          ? body.pageUrl.trim().slice(0, 2048)
          : body.url || null,
      screenshotUrl,
      createdAt: new Date(),
    };

    const result = await db
      .collection(TICKETS_COLLECTION)
      .insertOne(newTicketData);

    return NextResponse.json(
      {
        success: true,
        ticket: { ...newTicketData, _id: result.insertedId },
      },
      { status: 201, headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error("Error en POST /api/tickets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al guardar el ticket en la base de datos",
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
