/**
 * Loader de Fixea: anillo giratorio con el borde degradado neón de la marca.
 *
 * - <FixeaLoader /> en línea (botones, etiquetas).
 * - <FixeaLoader label="Cargando tickets…" /> con texto.
 * - <FixeaLoader fullScreen label="…" /> para transiciones de página.
 */
export default function FixeaLoader({
  size = 18,
  stroke,
  label = "",
  fullScreen = false,
  className = "",
}) {
  const ringStroke = stroke ?? Math.max(2, Math.round(size / 9));

  const ring = (
    <span
      aria-hidden="true"
      className="fixea-loader-ring inline-block shrink-0"
      style={{
        width: size,
        height: size,
        "--fixea-loader-stroke": `${ringStroke}px`,
      }}
    />
  );

  if (fullScreen) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[var(--Negro-fondo-1,#0B0C10)] ${className}`}
      >
        <FixeaLoaderRing size={Math.max(size, 56)} stroke={stroke ?? 4} />
        <span className="fixea-loader-label text-xs font-bold uppercase tracking-[0.25em] text-slate-400">
          {label || "Cargando"}
        </span>
      </div>
    );
  }

  if (!label) {
    return (
      <span role="status" aria-label="Cargando" className={`inline-flex ${className}`}>
        {ring}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      {ring}
      <span className="fixea-loader-label text-xs font-semibold text-slate-400">
        {label}
      </span>
    </span>
  );
}

function FixeaLoaderRing({ size, stroke }) {
  return (
    <span
      aria-hidden="true"
      className="fixea-loader-ring inline-block"
      style={{ width: size, height: size, "--fixea-loader-stroke": `${stroke}px` }}
    />
  );
}
