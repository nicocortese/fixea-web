import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { findActiveProject } from "@/lib/projectAccess";
import { projectMatchesOrigin } from "@/lib/projectMatch";
import {
  PROJECTS_COLLECTION,
  normalizeProjectKey,
  projectKeysMatch,
} from "@/models/Project";

function parseOrigin(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "");
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * La extensión del cliente valida acá la Key que le pasó el programador antes
 * de vincularse al proyecto que matcheó por URL. Responde lo mínimo y nunca
 * devuelve la Key.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400, headers: NO_STORE },
    );
  }

  const key = normalizeProjectKey(body?.key);
  if (!key) {
    return NextResponse.json(
      {
        success: false,
        error: "Formato de Key inválido (ej: FX-ABCD-EFGH-JKMN-PQRS)",
      },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    // 1) La Key del proyecto que matcheó por URL.
    let project = await findActiveProject(db, body?.projectId);
    if (project && !projectKeysMatch(project.accessKey, key)) project = null;

    // 2) La Key identifica al proyecto: si hay varios proyectos con la misma
    //    URL, vale la Key de cualquiera de ellos siempre que su URL coincida
    //    con el sitio donde está la extensión.
    if (!project) {
      const origin = parseOrigin(body?.origin);
      const byKey = await db
        .collection(PROJECTS_COLLECTION)
        .findOne({ accessKey: key, status: { $ne: "archived" } });

      if (
        byKey &&
        projectKeysMatch(byKey.accessKey, key) &&
        origin &&
        projectMatchesOrigin(byKey.targetUrl, origin)
      ) {
        project = byKey;
      }
    }

    if (!project) {
      return NextResponse.json(
        { success: false, error: "La Key no corresponde a este proyecto" },
        { status: 403, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        success: true,
        key,
        project: {
          id: String(project._id),
          name: typeof project.name === "string" ? project.name : "",
          targetUrl:
            typeof project.targetUrl === "string" ? project.targetUrl : "",
        },
      },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("Error en POST /api/projects/verify-key:", error);
    return NextResponse.json(
      { success: false, error: "Error al verificar la Key" },
      { status: 500, headers: NO_STORE },
    );
  }
}
