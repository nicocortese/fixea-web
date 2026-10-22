/**
 * Modelo de ticket (driver crudo de MongoDB, sin Mongoose).
 *
 * Metadata del DOM capturada por la extensión:
 * - selector: string (selector CSS del elemento señalado, máximo 500 caracteres)
 * - screenResolution: string (viewport del cliente, por ejemplo "1920x1080", máximo 40 caracteres)
 * - browserInfo: string (user agent del navegador, máximo 512 caracteres)
 * - url: string (URL completa de la página, máximo 2048 caracteres)
 *
 * `parseTicketMetadata` normaliza la entrada y devuelve `null` cuando no hay
 * datos utilizables.
 */

export const TICKETS_COLLECTION = "tickets";

export const MAX_METADATA_LENGTHS = {
  selector: 500,
  screenResolution: 40,
  browserInfo: 512,
  url: 2048,
};

const METADATA_FIELDS = ["selector", "screenResolution", "browserInfo", "url"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseTicketMetadata(input) {
  if (!isPlainObject(input)) return null;

  const metadata = {};
  let hasValue = false;

  for (const field of METADATA_FIELDS) {
    const raw = typeof input[field] === "string" ? input[field].trim() : "";
    const value = raw.slice(0, MAX_METADATA_LENGTHS[field]);
    metadata[field] = value;
    if (value) hasValue = true;
  }

  return hasValue ? metadata : null;
}
