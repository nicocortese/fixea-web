// Invitaciones por mail: un código corto asociado a un proyecto y a un email.
// Vive en su propia colección para no migrar los documentos de `projects`
// existentes (la Key del proyecto sigue funcionando igual).

export const INVITES_COLLECTION = "project_invites";

// Alfabeto sin caracteres ambiguos (0/O, 1/I/L), igual que la Key del proyecto.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_PATTERN = /^FXI(?:-[A-Z0-9]{4}){2}$/;

export function generateInviteCode() {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  const groups = [0, 4].map((i) => chars.slice(i, i + 4).join(""));
  return `FXI-${groups.join("-")}`;
}

// "fxiabcd1234" / "FXI-ABCD-1234" -> "FXI-ABCD-1234". Formato distinto al de
// la Key del proyecto (FX + 16) para que el backend sepa qué buscar.
export function normalizeInviteCode(value) {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  if (!compact.startsWith("FXI") || compact.length !== 11) return "";
  const body = compact.slice(3);
  const code = `FXI-${body.slice(0, 4)}-${body.slice(4, 8)}`;
  return CODE_PATTERN.test(code) ? code : "";
}

let indexesEnsured = false;

export async function ensureInviteIndexes(db) {
  if (indexesEnsured) return;

  try {
    await db
      .collection(INVITES_COLLECTION)
      .createIndex({ code: 1 }, { unique: true });
    await db
      .collection(INVITES_COLLECTION)
      .createIndex({ projectId: 1, createdAt: -1 });
    indexesEnsured = true;
  } catch (error) {
    // El índice único ya existe o Mongo no permite crearlo: el código se
    // valida igual en la aplicación.
    console.warn("No se pudieron asegurar los índices de invitaciones:", error);
  }
}
