import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { PROJECTS_COLLECTION } from "@/models/Project";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isIpAddress(host) {
  return (
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    host.includes(":")
  );
}

// Para aceptar subdominios, el proyecto guardado como "example.com" también
// debe matchear "app.example.com". Buscamos por cada sufijo del host actual y
// luego validamos la coincidencia exacta en JS.
function hostSuffixes(host) {
  if (isIpAddress(host)) return [host];

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1) return [host];

  const suffixes = [];
  // Excluye el TLD suelto ("com"): sólo hosts con al menos dos etiquetas.
  for (let index = 0; index < parts.length - 1; index += 1) {
    suffixes.push(parts.slice(index).join("."));
  }

  return suffixes.length > 0 ? suffixes : [host];
}

// El match es por origen/host: el path del targetUrl se ignora a propósito.
// Un proyecto guardado como "https://sitio.com/login" debe matchear cualquier
// ruta del sitio ("/", "/login", "/dashboard", etc.), porque la demo necesita
// inyectar el toolbar en toda la web registrada.
function hostMatchesTarget(target, current) {
  const targetHost = target.hostname.toLowerCase();
  const currentHost = current.hostname.toLowerCase();

  if (!targetHost || !currentHost) return false;

  const targetPort = target.port;
  const currentPort = current.port;
  const targetUsesDefaultPort =
    !targetPort || targetPort === (target.protocol === "https:" ? "443" : "80");
  const currentUsesDefaultPort =
    !currentPort || currentPort === (current.protocol === "https:" ? "443" : "80");

  if (
    targetHost === currentHost &&
    (targetPort === currentPort ||
      (targetUsesDefaultPort && currentUsesDefaultPort))
  ) {
    return true;
  }

  return (
    targetUsesDefaultPort &&
    currentUsesDefaultPort &&
    currentHost.endsWith(`.${targetHost}`)
  );
}

function projectMatchesOrigin(targetUrl, current) {
  if (typeof targetUrl !== "string" || !targetUrl.trim()) return false;

  let target;
  try {
    target = new URL(targetUrl);
  } catch (error) {
    return false;
  }

  if (!/^https?:$/.test(target.protocol)) return false;

  return hostMatchesTarget(target, current);
}

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

    // Si hay más de un candidato, gana el host más específico:
    // "app.example.com" antes que "example.com".
    let project = null;
    let bestHostLength = -1;

    for (const candidate of candidates) {
      if (!projectMatchesOrigin(candidate.targetUrl, current)) continue;

      let hostLength = 0;

      try {
        hostLength = new URL(candidate.targetUrl).hostname.length;
      } catch (error) {
        hostLength = 0;
      }

      if (hostLength > bestHostLength) {
        project = candidate;
        bestHostLength = hostLength;
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
