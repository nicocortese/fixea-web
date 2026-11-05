import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { membershipOf, readSession, toObjectId } from "@/lib/projectAccess";
import {
  PROJECTS_COLLECTION,
  normalizeProjectKey,
  projectKeysMatch,
  toPublicProject,
} from "@/models/Project";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body, status) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Vinculación bidireccional: cualquier usuario logueado (Desarrollador o
 * Cliente) se une al proyecto de la otra parte pegando su Key. Queda como
 * colaborador y desde ahí ve el proyecto, sus tickets y su Key.
 */
export async function POST(request) {
  const session = await readSession(request);
  if (!session) return json({ success: false, error: "Sesión no válida" }, 401);

  const userId = toObjectId(session.userId);
  if (!userId) return json({ success: false, error: "Sesión no válida" }, 401);

  const body = await request.json().catch(() => null);
  const key = normalizeProjectKey(body?.key);

  if (!key) {
    return json(
      {
        success: false,
        error: "Formato de Key inválido (ej: FX-ABCD-EFGH-JKMN-PQRS)",
      },
      400,
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const projects = db.collection(PROJECTS_COLLECTION);

    const project = await projects.findOne({
      accessKey: key,
      status: { $ne: "archived" },
    });

    if (!project || !projectKeysMatch(project.accessKey, key)) {
      return json(
        { success: false, error: "No encontramos un proyecto con esa Key" },
        404,
      );
    }

    const current = membershipOf(project, session.userId);

    if (!current) {
      await projects.updateOne(
        { _id: project._id },
        {
          // $addToSet: unirse dos veces no duplica al colaborador.
          $addToSet: { collaborators: userId },
          $set: { updatedAt: new Date() },
        },
      );
    }

    return json(
      {
        success: true,
        alreadyMember: Boolean(current),
        project: {
          ...toPublicProject(project, { includeKey: true }),
          membership: current || "collaborator",
        },
      },
      current ? 200 : 201,
    );
  } catch (error) {
    console.error("Error en POST /api/projects/join:", error);
    return json(
      { success: false, error: "No se pudo vincular el proyecto" },
      500,
    );
  }
}
