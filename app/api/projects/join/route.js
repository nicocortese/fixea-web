import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { membershipOf, readSession, toObjectId } from "@/lib/projectAccess";
import {
  PROJECTS_COLLECTION,
  normalizeProjectKey,
  projectKeysMatch,
  toPublicProject,
} from "@/models/Project";
import {
  INVITES_COLLECTION,
  normalizeInviteCode,
} from "@/models/ProjectInvite";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body, status) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Vinculación bidireccional: cualquier usuario logueado (Desarrollador o
 * Cliente) se une al proyecto de la otra parte con la Key del proyecto o con
 * el código que recibió por mail. Queda como colaborador y desde ahí ve el
 * proyecto, sus tickets y su Key.
 */
export async function POST(request) {
  const session = await readSession(request);
  if (!session) return json({ success: false, error: "Sesión no válida" }, 401);

  const userId = toObjectId(session.userId);
  if (!userId) return json({ success: false, error: "Sesión no válida" }, 401);

  const body = await request.json().catch(() => null);
  const rawKey = typeof body?.key === "string" ? body.key : "";
  const rawInvite =
    typeof body?.inviteCode === "string"
      ? body.inviteCode
      : typeof body?.code === "string"
        ? body.code
        : "";

  // El formato distingue Key de proyecto (FX-…) de código de invitación
  // (FXI-…), así que el mismo formulario puede aceptar ambos.
  const key = normalizeProjectKey(rawKey || rawInvite);
  const inviteCode = key ? "" : normalizeInviteCode(rawInvite || rawKey);

  if (!key && !inviteCode) {
    return json(
      {
        success: false,
        error:
          "Código inválido. Usá la Key del proyecto (FX-XXXX-XXXX-XXXX-XXXX) o el código que recibiste por mail (FXI-XXXX-XXXX).",
      },
      400,
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const projects = db.collection(PROJECTS_COLLECTION);
    const invites = db.collection(INVITES_COLLECTION);

    let project = null;
    let invite = null;

    if (key) {
      project = await projects.findOne({
        accessKey: key,
        status: { $ne: "archived" },
      });

      if (project && !projectKeysMatch(project.accessKey, key)) project = null;

      if (!project) {
        return json(
          { success: false, error: "No encontramos un proyecto con esa Key" },
          404,
        );
      }
    } else {
      invite = await invites.findOne({ code: inviteCode });

      if (invite && invite.acceptedAt) {
        const alreadyUsedByMe =
          String(invite.acceptedBy || "") === String(userId);

        if (!alreadyUsedByMe) {
          return json(
            {
              success: false,
              error: "Este código ya fue utilizado. Pedí uno nuevo.",
            },
            409,
          );
        }
      }

      if (invite) {
        project = await projects.findOne({
          _id: invite.projectId,
          status: { $ne: "archived" },
        });
      }

      if (!project) {
        return json(
          {
            success: false,
            error: "El código no es válido o el proyecto ya no está activo",
          },
          404,
        );
      }

      // Canje atómico: si dos personas usan el mismo código a la vez, sólo una
      // gana. Reintentar con el mismo usuario sigue funcionando.
      const claim = await invites.findOneAndUpdate(
        {
          _id: invite._id,
          $or: [{ acceptedAt: null }, { acceptedBy: userId }],
        },
        {
          $set: {
            acceptedAt: new Date(),
            acceptedBy: userId,
            updatedAt: new Date(),
          },
        },
      );

      if (!claim) {
        return json(
          {
            success: false,
            error: "Este código ya fue utilizado. Pedí uno nuevo.",
          },
          409,
        );
      }
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
        via: key ? "key" : "invite",
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
