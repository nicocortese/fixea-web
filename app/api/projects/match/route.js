import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { PROJECTS_COLLECTION } from "@/models/Project";
import { USERS_COLLECTION } from "@/models/User";
import { toObjectId } from "@/lib/projectAccess";
import { EXTENSION_CORS_HEADERS, withHeaders } from "@/lib/cors";
import {
  escapeRegExp,
  hostSuffixes,
  isLoopbackHost,
  projectMatchesOrigin,
} from "@/lib/projectMatch";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: EXTENSION_CORS_HEADERS });
}

async function matchProject(request) {
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

    const hosts = isLoopbackHost(current.hostname)
      ? [...new Set([...suffixes, "localhost", "127.0.0.1", "::1"])]
      : suffixes;

    const patterns = hosts.map((host) => ({
      targetUrl: { $regex: escapeRegExp(host), $options: "i" },
    }));

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    const candidates = await db
      .collection(PROJECTS_COLLECTION)
      .find({
        status: { $ne: "archived" },
        targetUrl: { $ne: "" },
        $or: patterns,
      })
      .limit(200)
      .toArray();

    const linked = new Set(
      (params.get("linked") || "")
        .split(",")
        .map((id) => id.trim().toLowerCase())
        .filter((id) => /^[a-f0-9]{24}$/.test(id))
        .slice(0, 50),
    );

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
        id: String(user._id),
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

export const GET = withHeaders(matchProject, EXTENSION_CORS_HEADERS);
