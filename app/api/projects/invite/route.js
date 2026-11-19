import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import {
  findActiveProject,
  membershipOf,
  readSession,
  toObjectId,
} from "@/lib/projectAccess";
import {
  INVITES_COLLECTION,
  ensureInviteIndexes,
  generateInviteCode,
} from "@/models/ProjectInvite";
import { sendProjectInviteEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function json(body, status) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function appOrigin(request) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  const raw = configured.trim() || new URL(request.url).origin;
  return raw.replace(/\/+$/, "");
}

/**
 * Invita a un colaborador (cliente o programador) por email: genera un código
 * de vinculación, lo guarda asociado al proyecto y manda el mail.
 *
 * Si faltan credenciales SMTP la API responde igual con el código generado
 * (`emailSent: false` + `warning`): el flujo nunca queda bloqueado.
 */
export async function POST(request) {
  const session = await readSession(request);
  if (!session) return json({ success: false, error: "Sesión no válida" }, 401);

  const userId = toObjectId(session.userId);
  if (!userId) return json({ success: false, error: "Sesión no válida" }, 401);

  const body = await request.json().catch(() => null);
  const projectId = toObjectId(body?.projectId);

  if (!projectId) {
    return json({ success: false, error: "Proyecto inválido" }, 400);
  }

  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_PATTERN.test(email)) {
    return json(
      { success: false, error: "Ingresá un email válido" },
      400,
    );
  }

  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || "fixea");
    const project = await findActiveProject(db, projectId);

    if (!project) {
      return json(
        { success: false, error: "Proyecto no encontrado" },
        404,
      );
    }

    // Sólo quien ya es parte del proyecto puede invitar.
    if (!membershipOf(project, session.userId)) {
      return json(
        { success: false, error: "No sos parte de este proyecto" },
        403,
      );
    }

    await ensureInviteIndexes(db);

    const invites = db.collection(INVITES_COLLECTION);
    let code = "";

    // Reintenta ante una colisión improbable del código (índice único).
    for (let attempt = 0; attempt < 3 && !code; attempt += 1) {
      const candidate = generateInviteCode();
      try {
        await invites.insertOne({
          code: candidate,
          email,
          projectId: project._id,
          invitedBy: userId,
          acceptedAt: null,
          acceptedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        code = candidate;
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }

    if (!code) {
      return json(
        { success: false, error: "No se pudo generar el código de invitación" },
        500,
      );
    }

    const origin = appOrigin(request);
    // Sin `next`: el login manda a cada rol a su home conservando `invite`.
    const link = `${origin}/login?invite=${encodeURIComponent(code)}`;

    const mail = await sendProjectInviteEmail({
      to: email,
      projectName: project.name || "tu proyecto",
      code,
      link,
      invitedBy: session.email || "",
    });

    return json(
      {
        success: true,
        emailSent: mail.sent,
        code,
        email,
        link,
        warning: mail.sent ? "" : mail.error,
      },
      201,
    );
  } catch (error) {
    console.error("Error en POST /api/projects/invite:", error);
    return json(
      { success: false, error: "No se pudo enviar la invitación" },
      500,
    );
  }
}
