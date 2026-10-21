import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const VALID_STATUSES = ["PENDIENTE", "EN_PROCESO", "FINALIZADO"];

/**
 * Builds a query that matches either a MongoDB ObjectId or a numeric/string
 * business id. This keeps the API compatible with tickets created by POST,
 * which stores `id` as Date.now() (number).
 */
function buildTicketQuery(rawId) {
  const id = String(rawId);
  const conditions = [{ id }];

  const numericId = Number(id);
  if (Number.isSafeInteger(numericId) && String(numericId) === id) {
    conditions.push({ id: numericId });
  }

  if (/^[a-fA-F0-9]{24}$/.test(id) && ObjectId.isValid(id)) {
    conditions.push({ _id: new ObjectId(id) });
  }

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Falta el ID del ticket" },
        { status: 400 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "El cuerpo de la petición no es JSON válido" },
        { status: 400 },
      );
    }

    const hasStatus = body?.status !== undefined;
    const hasDevNote = body?.devNote !== undefined;

    if (!hasStatus && !hasDevNote) {
      return NextResponse.json(
        {
          success: false,
          error: "Nada para actualizar. Enviá al menos status o devNote",
        },
        { status: 400 },
      );
    }

    const updates = {};

    if (hasStatus) {
      const status =
        typeof body.status === "string" ? body.status.trim().toUpperCase() : "";

      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(", ")}`,
          },
          { status: 400 },
        );
      }

      updates.status = status;
    }

    if (hasDevNote) {
      if (typeof body.devNote !== "string") {
        return NextResponse.json(
          { success: false, error: "devNote debe ser un texto" },
          { status: 400 },
        );
      }

      updates.devNote = body.devNote.trim().slice(0, 2000);
    }

    updates.updatedAt = new Date();

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    const updatedTicket = await db.collection("tickets").findOneAndUpdate(
      buildTicketQuery(id),
      { $set: updates },
      { returnDocument: "after" },
    );

    if (!updatedTicket) {
      return NextResponse.json(
        { success: false, error: "Ticket no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, ticket: updatedTicket },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en PATCH /api/tickets/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar el estado del ticket" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Falta el ID del ticket" },
        { status: 400 },
      );
    }

    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");

    const result = await db
      .collection("tickets")
      .deleteOne(buildTicketQuery(id));

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Ticket no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Ticket eliminado correctamente" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error en DELETE /api/tickets/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Error al borrar el ticket" },
      { status: 500 },
    );
  }
}
