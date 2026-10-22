import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import {
  PROJECTS_COLLECTION,
  ensureProjectIndexes,
  parseProjectInput,
  toPublicProject,
} from "@/models/Project";

export const dynamic = "force-dynamic";

/**
 * Migración de arranque: si todavía no existe ningún proyecto, crea uno por
 * cada nombre de proyecto que ya tengan los tickets históricos. Así el tablero
 * no queda vacío después de introducir el modelo de proyectos.
 */
async function bootstrapProjects(db) {
  const projects = db.collection(PROJECTS_COLLECTION);

  const existing = await projects.countDocuments();

  if (existing > 0) {
    return;
  }

  // Un índice único hace que dos requests concurrentes no dupliquen nombres.
  await ensureProjectIndexes(db);

  const names = await db.collection("tickets").distinct("project", {
    project: { $nin: [null, "", "Sin proyecto"] },
  });

  const seen = new Set();
  const documents = [];

  for (const rawName of names) {
    if (typeof rawName !== "string") continue;

    const name = rawName.trim();
    if (!name || name === "Sin proyecto") continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    documents.push({
      name,
      clientName: "",
      targetUrl: "",
      status: "active",
      createdAt: new Date(),
    });
  }

  if (documents.length > 0) {
    try {
      await projects.insertMany(documents, { ordered: false });
    } catch (error) {
      // 11000 = duplicate key: otro request ganó el bootstrap.
      if (error?.code !== 11000) throw error;
    }
  }
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    await bootstrapProjects(db);

    const projects = await db
      .collection(PROJECTS_COLLECTION)
      .find({ status: "active" })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(
      { success: true, projects: projects.map(toPublicProject) },
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
    const body = await request.json();
    const parsed = parseProjectInput(body);

    if (parsed.error) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const projects = db.collection(PROJECTS_COLLECTION);

    await ensureProjectIndexes(db);

    const duplicate = await projects.findOne(
      { name: parsed.value.name },
      { collation: { locale: "es", strength: 2 } },
    );

    if (duplicate) {
      return NextResponse.json(
        { success: false, error: "Ya existe un proyecto con ese nombre" },
        { status: 409 },
      );
    }

    let result;

    try {
      result = await projects.insertOne(parsed.value);
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

    const project = toPublicProject({
      ...parsed.value,
      _id: result.insertedId,
    });

    return NextResponse.json(
      { success: true, project },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error en POST /api/projects:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear el proyecto" },
      { status: 500 },
    );
  }
}
