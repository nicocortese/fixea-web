import nodemailer from "nodemailer";

// Configuración por variables de entorno estándar. `EMAIL_USER` / `EMAIL_PASS`
// funcionan como alias para no atar el proyecto a un proveedor puntual.
function readMailConfig() {
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || "").trim();
  const portRaw = (process.env.SMTP_PORT || process.env.EMAIL_PORT || "").trim();
  const port = Number(portRaw || 587);
  const user = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";
  const from =
    (process.env.SMTP_FROM || process.env.EMAIL_FROM || "").trim() || user;

  if (!host || !user || !pass || !Number.isFinite(port)) return null;

  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

export function isMailConfigured() {
  return Boolean(readMailConfig());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Evita saltos de línea en asunto/cuerpo (nombres de proyecto vienen del usuario).
function singleLine(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function buildInviteBodies({ projectName, code, link, invitedBy }) {
  const safeProject = singleLine(projectName);
  const safeInviter = singleLine(invitedBy);
  const htmlProject = escapeHtml(safeProject);
  const htmlInviter = escapeHtml(safeInviter);

  const intro = safeInviter
    ? `${safeInviter} te invitó a colaborar en "${safeProject}" en FIXEA.`
    : `Te invitaron a colaborar en "${safeProject}" en FIXEA.`;

  const htmlIntro = safeInviter
    ? `${htmlInviter} te invitó a colaborar en "${htmlProject}" en FIXEA.`
    : `Te invitaron a colaborar en "${htmlProject}" en FIXEA.`;

  const text = [
    intro,
    "",
    `Código de acceso: ${code}`,
    "",
    "Para aceptar la invitación:",
    `1. Ingresá a ${link}`,
    "2. Iniciá sesión o creá tu cuenta.",
    `3. Pegá el código ${code} en "Unirse a un proyecto".`,
    "",
    "Si no esperabas esta invitación, ignorá este mensaje.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#0B0C10;padding:24px;color:#F1F5F9">
      <div style="max-width:520px;margin:0 auto;background:#1F2029;border-radius:16px;padding:28px;border:1px solid #00E5FF33">
        <h2 style="margin:0 0 12px;color:#00E5FF;font-size:18px">FIXEA</h2>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#CBD5E1">${htmlIntro}</p>
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#94A3B8">Código de acceso</p>
        <p style="margin:0 0 20px;font-size:22px;font-weight:bold;letter-spacing:2px;color:#FFFFFF">${code}</p>
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#00E5FF;color:#0B0C10;font-weight:bold;padding:10px 18px;border-radius:10px;text-decoration:none;font-size:14px">Abrir FIXEA</a>
        <p style="margin:20px 0 0;font-size:12px;color:#94A3B8">Ingresá con tu cuenta y pegá el código en "Unirse a un proyecto".</p>
        <p style="margin:12px 0 0;font-size:11px;color:#64748B">Si no esperabas esta invitación, ignorá este mensaje.</p>
      </div>
    </div>
  `;

  return { text, html, subjectProject: safeProject };
}

/**
 * Envía la invitación. Nunca lanza: devuelve `{ sent, error }` para que la API
 * pueda responder el código igual y el flujo no quede bloqueado por SMTP.
 */
export async function sendProjectInviteEmail({
  to,
  projectName,
  code,
  link,
  invitedBy,
}) {
  const config = readMailConfig();

  if (!config) {
    return {
      sent: false,
      error:
        "No hay credenciales de correo configuradas. Definí SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS (o EMAIL_USER / EMAIL_PASS) en .env.local. El código se generó igual: compartilo manualmente.",
    };
  }

  const { text, html, subjectProject } = buildInviteBodies({
    projectName,
    code,
    link,
    invitedBy,
  });

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });

    await transporter.sendMail({
      from: config.from,
      to,
      subject: `Invitación a ${subjectProject} en FIXEA`,
      text,
      html,
    });

    return { sent: true, error: "" };
  } catch (error) {
    console.error("Error al enviar la invitación por mail:", error);
    return {
      sent: false,
      error: `No se pudo enviar el mail (${error?.message || "error desconocido"}). El código se generó igual: compartilo manualmente.`,
    };
  }
}
