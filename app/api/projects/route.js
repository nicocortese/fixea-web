import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import {
  memberProjectsFilter,
  membershipOf,
  toObjectId,
} from "@/lib/projectAccess";
import { USERS_COLLECTION } from "@/models/User";
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

  if (!raw) return { value: "" };

  let candidate = raw;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = /^(?:localhost|127\.0\.0\.1|\[::1\])(?=[:/]|$)/i.test(candidate)
      ? `http://${candidate}`
      : `https://${candidate}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return {
      error:
        "La URL objetivo no es válida (ej: https://misitio.com o http://localhost:3000)",
    };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "La URL objetivo debe empezar con http:// o https://" };
  }

  return { value: candidate };
}

export async function GET(request) {
  try {
    const session = await verifySession(
      request.cookies.get(SESSION_COOKIE)?.value,
    );

    if (!session) return unauthorized();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    const filter = memberProjectsFilter(session.userId);
    if (!filter) return unauthorized();

    const projects = await db
      .collection(PROJECTS_COLLECTION)
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

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

    const userIds = new Map();
    for (const project of projects) {
      const ids = [
        project.ownerId || project.userId,
        ...(Array.isArray(project.collaborators) ? project.collaborators : []),
      ];
      for (const value of ids) {
        const id = toObjectId(value);
        if (id) userIds.set(String(id), id);
      }
    }

    const users = userIds.size
      ? await db
          .collection(USERS_COLLECTION)
          .find(
            { _id: { $in: [...userIds.values()] } },
            { projection: { email: 1 } },
          )
          .toArray()
      : [];
    const emailById = new Map(
      users.map((user) => [String(user._id), user.email || ""]),
    );
    const emailOf = (value) => emailById.get(String(value ?? "")) || "";

    return NextResponse.json(
      {
        success: true,
        projects: projects.map((project) => ({
          ...toPublicProject(project, { includeKey: true }),
          membership: membershipOf(project, session.userId),
          ownerEmail: emailOf(project.ownerId || project.userId),
          collaboratorEmails: (Array.isArray(project.collaborators)
            ? project.collaborators
            : []
          )
            .map(emailOf)
            .filter(Boolean),
        })),
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
      parsed.value?.targetUrl ?? body?.targetUrl,
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
      collaborators: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    let result;

    try {
      result = await projects.insertOne(document);
    } catch (error) {
      if (error?.code === 11000) {
        return NextResponse.json(
          { success: false, error: "Ya existe un proyecto con ese nombre" },
          { status: 409 },
        );
      }
      throw error;
    }

    const project = {
      ...toPublicProject(
        { ...document, _id: result.insertedId },
        { includeKey: true },
      ),
      membership: "owner",
    };

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/projects:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear el proyecto" },
      { status: 500 },
    );
  }
}
