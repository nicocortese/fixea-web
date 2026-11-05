import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { PROJECTS_COLLECTION } from "@/models/Project";
import {
  escapeRegExp,
  hostSuffixes,
  projectMatchesOrigin,
} from "@/lib/projectMatch";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Verificación silenciosa que usa la extensión para decidir si inyecta el
 * toolbar. Es pública y de sólo lectura: devuelve el mínimo dato necesario
 * (id, nombre y URL) y nunca expone clientes, dueños ni tickets.
 *
 * Acepta `url` (URL completa) u `origin`, pero el match es por origen/host:
 * el path se ignora para inyectar en toda la web registrada.
 */
export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const rawUrl = params.get("url") || params.get("origin") || "";

    let current;
    try {
      current = new URL(rawUrl);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "URL inválida" },
        { status: 400, headers: NO_STORE },
      );
    }

    if (!/^https?:$/.test(current.protocol)) {
      return NextResponse.json(
        { success: false, error: "URL inválida" },
        { status: 400, headers: NO_STORE },
      );
    }

    if (current.username || current.password) {
      return NextResponse.json(
        { success: false, error: "URL inválida" },
        { status: 400, headers: NO_STORE },
      );
    }

    const suffixes = hostSuffixes(current.hostname.toLowerCase());
    const patterns = suffixes.map((host) => ({
      targetUrl: { $regex: escapeRegExp(host), $options: "i" },
    }));

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    // Los proyectos históricos pueden no tener `status`. `$ne: "archived"`
    // los trata como activos sin necesidad de migrarlos.
    const candidates = await db
      .collection(PROJECTS_COLLECTION)
      .find({
        status: { $ne: "archived" },
        $or: patterns,
      })
      .limit(200)
      .toArray();

    // Proyectos para los que la extensión ya tiene Key: si varios proyectos
    // apuntan al mismo sitio (duplicados de pruebas), gana el que el cliente
    // vinculó con su Key en lugar del primero que aparezca.
    const linked = new Set(
      (params.get("linked") || "")
        .split(",")
        .map((id) => id.trim().toLowerCase())
        .filter((id) => /^[a-f0-9]{24}$/.test(id))
        .slice(0, 50),
    );

    // Orden: vinculado con Key > host más específico ("app.example.com"
    // antes que "example.com") > más reciente.
    let project = null;
    let bestScore = null;

    for (const candidate of candidates) {
      if (!projectMatchesOrigin(candidate.targetUrl, current)) continue;

      let hostLength = 0;

      try {
        hostLength = new URL(candidate.targetUrl).hostname.length;
      } catch (error) {
        hostLength = 0;
      }

      const score = [
        linked.has(String(candidate._id).toLowerCase()) ? 1 : 0,
        hostLength,
        candidate.createdAt ? new Date(candidate.createdAt).getTime() : 0,
      ];

      const better =
        !bestScore ||
        score.some((value, index) =>
          score.slice(0, index).every((v, i) => v === bestScore[i]) &&
          value > bestScore[index],
        );

      if (better) {
        project = candidate;
        bestScore = score;
      }
    }

    if (!project) {
      return NextResponse.json(
        { success: true, match: false },
        { status: 200, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        success: true,
        match: true,
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
    console.error("Error en GET /api/projects/match:", error);
    return NextResponse.json(
      { success: false, error: "Error al verificar el proyecto" },
      { status: 500, headers: NO_STORE },
    );
  }
}
