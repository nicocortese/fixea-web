const LOCALE = "es-AR";
const TIME_ZONE = "America/Argentina/Buenos_Aires";

function toValidDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(value) {
  const date = toValidDate(value);
  if (!date) return null;

  return date.toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  });
}

export function formatDate(value) {
  const date = toValidDate(value);
  if (!date) return null;

  return date.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

// Example: 21/10/2026 18:35 (Argentina, UTC-3).
export function formatDateTime(value) {
  const date = formatDate(value);
  const time = formatTime(value);

  if (!date || !time) return null;

  return `${date} ${time}`;
}
