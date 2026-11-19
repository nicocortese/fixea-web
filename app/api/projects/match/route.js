import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { PROJECTS_COLLECTION } from "@/models/Project";
import { USERS_COLLECTION } from "@/models/User";
import { toObjectId } from "@/lib/projectAccess";
import {
  escapeRegExp,
  hostSuffixes,
  isLoopbackHost,
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

    // En desarrollo local cualquier variante de loopback es el mismo sitio:
    // un proyecto guardado con "127.0.0.1" debe aparecer al navegar
    // "localhost" (y viceversa). Sin esto el pre-filtro de Mongo lo descarta
    // antes de llegar a projectMatchesOrigin.
    const hosts = isLoopbackHost(current.hostname)
      ? [...new Set([...suffixes, "localhost", "127.0.0.1", "::1"])]
      : suffixes;

    const patterns = hosts.map((host) => ({
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
        // Proyectos sin URL (permitidos desde ahora) no pueden matchear.
        targetUrl: { $ne: "" },
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

    // Miembros del proyecto (dueño + colaboradores) para que la extensión
    // pueda mostrar a quién va dirigida la corrección. Sólo datos básicos.
    const memberIds = [
      project.ownerId,
      project.userId,
      ...(Array.isArray(project.collaborators) ? project.collaborators : []),
    ]
      .map((value) => toObjectId(value))
      .filter(Boolean);

    const uniqueIds = [
      ...new Map(memberIds.map((id) => [String(id), id])).values(),
    ];

    let members = [];

    if (uniqueIds.length > 0) {
      const users = await db
        .collection(USERS_COLLECTION)
        .find(
          { _id: { $in: uniqueIds } },
          { projection: { name: 1, email: 1, role: 1 } },
        )
        .toArray();

      members = users.map((user) => ({
        name: typeof user.name === "string" ? user.name : "",
        email: typeof user.email === "string" ? user.email : "",
        role: typeof user.role === "string" ? user.role : "client",
      }));
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
          members,
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
