import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    const tickets = await db
      .collection("tickets")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, tickets }, { status: 200 });
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
        { status: 400 },
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
        { status: 400 },
      );
    }

    if (screenshotUrl && screenshotUrl.length > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "El screenshot supera el tamaño máximo permitido (4 MB)",
        },
        { status: 413 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    const newTicketData = {
      id: body.id || Date.now(),
      number: body.number ?? null,
      type: body.type || null,
      color: body.color || null,
      shape: body.shape || null,
      project:
        typeof body.project === "string" && body.project.trim()
          ? body.project.trim()
          : "Sin proyecto",
      projectId:
        typeof body.projectId === "string" && body.projectId.trim()
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
      url: body.url || null,
      screenshotUrl,
      createdAt: new Date(),
    };

    const result = await db.collection("tickets").insertOne(newTicketData);

    return NextResponse.json(
      {
        success: true,
        ticket: { ...newTicketData, _id: result.insertedId },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error en POST /api/tickets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Error al guardar el ticket en la base de datos",
      },
      { status: 500 },
    );
  }
}
