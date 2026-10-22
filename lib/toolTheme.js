// Tema compartido de herramientas. Vive fuera de React para que la toolbar y la
// página del cliente usen exactamente los mismos colores y cursores.

export const COLORS = [
  { value: "#00e5ff", name: "Cian" },
  { value: "#ff007f", name: "Magenta" },
  { value: "#7000FF", name: "Violeta" },
];

const PENCIL_SVG = (color) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='${color}' stroke='#ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m4 20 4.2-1.1a2 2 0 0 0 1-.55l9.9-9.9a2.1 2.1 0 0 0 0-3l-1.55-1.55a2.1 2.1 0 0 0-3 0l-9.9 9.9a2 2 0 0 0-.55 1L3.9 19.1A.7.7 0 0 0 4 20z'/><path d='m14.5 6.5 3 3'/></svg>`;

// El punto caliente (4 20) cae en la punta del lápiz para que el trazado se
// distinga de la cruz por defecto.
export function pencilCursor(color = COLORS[0].value) {
  const svg = encodeURIComponent(PENCIL_SVG(color));
  return `url("data:image/svg+xml;utf8,${svg}") 4 20, crosshair`;
}

export const CANVAS_CURSOR = {
  highlight: "cell",
  arrow: "alias",
  blur: "crosshair",
  sticker: "copy",
  erase: "not-allowed",
};

export function cursorForTool(tool, color) {
  if (tool === "pin") return pencilCursor(color);
  return CANVAS_CURSOR[tool] ?? "crosshair";
}
