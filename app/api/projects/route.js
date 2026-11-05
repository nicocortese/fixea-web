import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import {
  PROJECTS_COLLECTION,
  ensureProjectIndexes,
  generateProjectKey,
  parseProjectInput,
  toPublicProject,
} from "@/models/Project";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { success: false, error: "Sesión no válida" },
    { status: 401 },
  );
}

function normalizeTargetUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!raw) return { error: "La URL objetivo es obligatoria" };

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: "La URL objetivo no es válida (ej: https://misitio.com)" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "La URL objetivo debe empezar con http:// o https://" };
  }

  return { value: raw };
}

export async function GET(request) {
  try {
    const session = await verifySession(
      request.cookies.get(SESSION_COOKIE)?.value,
    );

    if (!session) return unauthorized();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    // MVP: todo usuario autenticado ve el workspace completo. El loop de
    // trabajo es cliente registra el sitio -> dev recibe los tickets en su
    // Kanban, así que el dev no puede quedar limitado a los proyectos que creó.
    // `$ne: "archived"` también incluye proyectos históricos sin `status`,
    // para que la lista no quede vacía después de la migración al driver nativo.
    const projects = await db
      .collection(PROJECTS_COLLECTION)
      .find({ status: { $ne: "archived" } })
      .sort({ createdAt: -1 })
      .toArray();

    // Sólo el programador ve las Keys: es quien se las pasa a su cliente.
    // Un cliente logueado en la web no debe poder leer las de otros proyectos.
    const isDev = session.role === "dev";

    if (isDev) {
      // Proyectos creados antes de que existieran las Keys: se les genera una.
      for (const project of projects) {
        if (project.accessKey) continue;
        project.accessKey = generateProjectKey();
        await db
          .collection(PROJECTS_COLLECTION)
          .updateOne(
            { _id: project._id },
            { $set: { accessKey: project.accessKey, updatedAt: new Date() } },
          );
      }
    }

    return NextResponse.json(
      {
        success: true,
        projects: projects.map((project) =>
          toPublicProject(project, { includeKey: isDev }),
        ),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en GET /api/projects:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener los proyectos" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const session = await verifySession(
      request.cookies.get(SESSION_COOKIE)?.value,
    );

    if (!session) return unauthorized();

    if (session.role !== "dev" && session.role !== "client") {
      return NextResponse.json(
        { success: false, error: "No tenés permiso para crear proyectos" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = parseProjectInput(body);

    if (parsed.error) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    const target = normalizeTargetUrl(
      body?.targetUrl ?? parsed.value?.targetUrl,
    );

    if (target.error) {
      return NextResponse.json(
        { success: false, error: target.error },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const projects = db.collection(PROJECTS_COLLECTION);

    let ownerId;

    try {
      ownerId = new ObjectId(session.userId);
    } catch (error) {
      return unauthorized();
    }

    await ensureProjectIndexes(db);

    const duplicate = await projects.findOne(
      { ownerId, name: parsed.value.name },
      { collation: { locale: "es", strength: 2 } },
    );

    if (duplicate) {
      return NextResponse.json(
        { success: false, error: "Ya existe un proyecto con ese nombre" },
        { status: 409 },
      );
    }

    const document = {
      ...parsed.value,
      targetUrl: target.value,
      status: "active",
      accessKey: generateProjectKey(),
      ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let result;

    try {
      result = await projects.insertOne(document);
    } catch (error) {
      // Carrera entre dos POST con el mismo nombre (o distinta capitalización).
      if (error?.code === 11000) {
        return NextResponse.json(
          { success: false, error: "Ya existe un proyecto con ese nombre" },
          { status: 409 },
        );
      }
      throw error;
    }

    // Quien crea el proyecto recibe la Key para compartirla con el cliente.
    const project = toPublicProject(
      { ...document, _id: result.insertedId },
      { includeKey: true },
    );

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/projects:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear el proyecto" },
      { status: 500 },
    );
  }
}
