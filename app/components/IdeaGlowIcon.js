// Bombilla con resplandor dorado: SVG propio para no depender del ícono plano
// de la librería y mantener el glow suave del tema FIXEA. Compartida entre
// las tarjetas del Kanban, el modal de detalle y la revisión del cliente.
export default function IdeaGlowIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ filter: "drop-shadow(0 0 6px rgba(255,214,0,0.65))" }}
    >
      <path
        d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6l.1.6h5.2l.1-.6c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3Z"
        stroke="#FFD600"
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill="rgba(255,214,0,0.12)"
      />
      <path
        d="M9.5 18h5M10.5 21h3M12 6.5v4.2"
        stroke="#FFD600"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Comentario del cliente entre comillas (nunca entre paréntesis).
export function quoteComment(value, fallback = "Sin descripción") {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  return `"${text.replace(/^["“”(]+|["“”)]+$/g, "").trim()}"`;
}
