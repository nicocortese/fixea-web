"use client";
import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  Eraser,
  RotateCcw,
  ArrowRight,
  Pencil,
  Highlighter,
  StickyNote,
  Send,
  Minus,
  Plus,
} from "lucide-react";
import ReportTicketModal from "./ReportTicketModal";
import { COLORS } from "@/lib/toolTheme";

const STORAGE_KEY = "fixea_custom_tickets";

// En el servidor no existe layout: se usa useEffect para evitar el warning de
// useLayoutEffect durante el render SSR.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const COLOR_TOOLS = ["pin", "arrow", "highlight", "blur", "sticker"];
const DRAG_TOOLS = ["arrow", "highlight", "blur"];
const MIN_DRAG = 8;

// Matriz de puntos del ícono de desenfoque (halftone): grilla de 7x7 recortada
// en círculo, con el radio decreciendo hacia los bordes como en el Figma.
const BLUR_DOTS = (() => {
  const STEP = 2.6;
  const dots = [];

  for (let row = -3; row <= 3; row += 1) {
    for (let col = -3; col <= 3; col += 1) {
      const dx = col * STEP;
      const dy = row * STEP;
      const distance = Math.hypot(dx, dy);

      if (distance > 8.4) continue;

      dots.push({
        cx: 12 + dx,
        cy: 12 + dy,
        r: Math.max(0.45, 1.6 - distance * 0.14),
      });
    }
  }

  return dots;
})();

function BlurIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {BLUR_DOTS.map((dot) => (
        <circle
          key={`blur-dot-${dot.cx}-${dot.cy}`}
          cx={dot.cx}
          cy={dot.cy}
          r={dot.r}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

const ERASER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='%2300e5ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3a1 1 0 0 1 0-1.4l13-13a1 1 0 0 1 1.4 0l4.3 4.3a1 1 0 0 1 0 1.4l-13 13a1 1 0 0 1-1.4 0z'/><path d='M22 21H7'/><path d='m5 11 9 9'/></svg>") 4 20, not-allowed`;

const FIXEA_CSS = `
/* Los elementos propios de Fixea (toolbar, badges, modales) siempre reciben
   punteros y nunca dejan pasar el clic al canvas. */
[data-fixea-ui] { pointer-events: auto; }

/* El canvas define su cursor según la herramienta activa desde la página.
   Acá solo se protege la UI para que no herede la cruz ni la goma. */
html.fixea-drawing [data-fixea-ui], html.fixea-drawing [data-fixea-ui] * { cursor: pointer !important; }
html.fixea-drawing textarea[data-fixea-ui] { cursor: text !important; user-select: text !important; }

/* La barra desplegada crece desde la esquina inferior derecha, que es donde
   vive el botón "+" minimizado, así el salto de posición es mínimo. */
@keyframes fixea-toolbar-in {
  from { opacity: 0; transform: translate(8px, 12px) scale(0.94); }
  to { opacity: 1; transform: translate(0, 0) scale(1); }
}
.fixea-toolbar-expand {
  transform-origin: bottom right;
  animation: fixea-toolbar-in 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
@media (prefers-reduced-motion: reduce) {
  .fixea-toolbar-expand { animation: none; }
}

html.fixea-erasing, html.fixea-erasing * { cursor: ${ERASER_CURSOR} !important; }
html.fixea-erasing [data-fixea-ui], html.fixea-erasing [data-fixea-ui] * { cursor: pointer !important; }
html.fixea-erasing textarea[data-fixea-ui] { cursor: text !important; }

.fixea-pin-badge {
  position: absolute; z-index: 20;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9999px;
  background: #0b0c10;
  border: 2px solid var(--fixea-c, #00e5ff);
  color: var(--fixea-c, #00e5ff);
  font: 900 14px system-ui, -apple-system, sans-serif;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 20px var(--fixea-c, #00e5ff);
  pointer-events: none;
}
.fixea-pin-badge.fixea-pin-small {
  width: 24px; height: 24px; font-size: 11px;
  box-shadow: 0 0 12px var(--fixea-c, #00e5ff);
}
.fixea-pin-action {
  pointer-events: auto;
  cursor: pointer;
  padding: 0;
  appearance: none;
  transition: transform 0.15s ease;
}
.fixea-pin-action:hover { transform: translate(-50%, -50%) scale(1.08); }
.fixea-pin-action:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.fixea-shape { filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.45)); }
.fixea-blur {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background-color: rgba(8, 9, 14, 0.06);
  background-image: radial-gradient(rgba(255, 255, 255, 0.16) 0.5px, transparent 0.5px);
  background-size: 4px 4px;
  backdrop-filter: blur(10px) saturate(0.8);
  -webkit-backdrop-filter: blur(10px) saturate(0.8);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}

html.fixea-erasing .fixea-pin-badge {
  border-color: #ff0055; color: #ff0055;
  box-shadow: 0 0 20px rgba(255, 0, 85, 0.8);
}
html.fixea-erasing .fixea-shape { filter: drop-shadow(0 0 4px #ff0055); }
`;

function readTickets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTickets(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const pageKey = () => window.location.origin + window.location.pathname + window.location.search;
const cl = (v) => Math.max(0, Math.round(v));

function buildAnnotation(g) {
  const { id, type, color, x0, y0, x, y } = g;
  const base = { id, type, color };

  switch (type) {
    case "arrow": {
      const s = g.dragging
        ? { x1: x0, y1: y0, x2: x, y2: y }
        : { x1: cl(x0 - 70), y1: cl(y0 - 70), x2: x0, y2: y0 };
      return { ...base, coords: { x: s.x1, y: s.y1 }, shape: s };
    }
    case "highlight": {
      const pts = g.dragging
        ? g.points
        : [
            [cl(x0 - 45), y0],
            [x0 + 45, y0],
          ];
      return { ...base, coords: { x: pts[0][0], y: pts[0][1] }, shape: { points: pts } };
    }
    case "blur": {
      const s = g.dragging
        ? { x: Math.min(x0, x), y: Math.min(y0, y), w: Math.abs(x - x0), h: Math.abs(y - y0) }
        : { x: cl(x0 - 90), y: cl(y0 - 60), w: 180, h: 120 };
      return { ...base, coords: { x: s.x, y: s.y }, shape: s };
    }
    case "sticker": {
      const s = { x: cl(x0 - 75), y: cl(y0 - 50), w: 150, h: 100 };
      return { ...base, coords: { x: s.x, y: s.y }, shape: s };
    }
    default:
      return { ...base, type: "pin", coords: { x: x0, y: y0 }, shape: null };
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitAnnotation(a, px, py) {
  const s = a.shape || {};
  const badgeR = a.type === "pin" ? 18 : 12;
  if (a.coords && Math.hypot(px - a.coords.x, py - a.coords.y) <= badgeR) return true;

  switch (a.type) {
    case "arrow":
      return distToSegment(px, py, s.x1, s.y1, s.x2, s.y2) <= 12;
    case "highlight": {
      const p = s.points || [];
      for (let i = 0; i < p.length - 1; i++) {
        if (distToSegment(px, py, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) <= 14) return true;
      }
      return false;
    }
    case "blur":
    case "sticker":
      return px >= s.x - 6 && px <= s.x + s.w + 6 && py >= s.y - 6 && py <= s.y + s.h + 6;
    default:
      return false;
  }
}

function hitTest(items, px, py) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (hitAnnotation(items[i], px, py)) return items[i];
  }
  return null;
}

function wrapText(str, max, maxLines) {
  const words = String(str || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = (cur + " " + w).trim();
    if (next.length <= max) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.slice(0, max);
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, max - 1) + "…";
  }
  return lines;
}

function ShapeView({ ann }) {
  const s = ann.shape;
  const c = ann.color;
  if (!s || ann.type === "pin" || ann.type === "blur") return null;

  if (ann.type === "arrow") {
    const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    const head = 16;
    const spread = Math.PI / 7;
    const ax = s.x2 - head * Math.cos(ang - spread);
    const ay = s.y2 - head * Math.sin(ang - spread);
    const bx = s.x2 - head * Math.cos(ang + spread);
    const by = s.y2 - head * Math.sin(ang + spread);
    return (
      <g className="fixea-shape" data-fixea-id={ann.id}>
        <path
          d={`M${s.x1} ${s.y1}L${s.x2} ${s.y2}M${ax} ${ay}L${s.x2} ${s.y2}L${bx} ${by}`}
          fill="none"
          stroke={c}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }

  if (ann.type === "highlight") {
    const pts = s.points;
    let d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("");
    if (pts.length === 1) d += `L${pts[0][0]} ${pts[0][1]}`;
    return (
      <g className="fixea-shape" data-fixea-id={ann.id}>
        <path
          d={d}
          fill="none"
          stroke={c}
          strokeOpacity={0.4}
          strokeWidth={18}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }

  const fold = 18;
  const lines = wrapText(ann.title, 17, 4);
  return (
    <g className="fixea-shape" data-fixea-id={ann.id}>
      <path
        d={`M${s.x} ${s.y}H${s.x + s.w - fold}L${s.x + s.w} ${s.y + fold}V${s.y + s.h}H${s.x}Z`}
        fill={c}
        fillOpacity={0.92}
        stroke="#08090e"
        strokeOpacity={0.35}
      />
      <path d={`M${s.x + s.w - fold} ${s.y}V${s.y + fold}H${s.x + s.w}Z`} fill="#000" fillOpacity={0.18} />
      <text
        x={s.x + 10}
        y={s.y + 32}
        fill="#08090e"
        fontSize={12}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={s.x + 10} dy={i ? 15 : 0}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function BlurOverlay({ ann }) {
  if (ann.type !== "blur" || !ann.shape) return null;
  const s = ann.shape;
  return (
    <div
      className="fixea-blur"
      data-fixea-id={ann.id}
      style={{
        left: s.x,
        top: s.y,
        width: Math.max(1, s.w),
        height: Math.max(1, s.h),
      }}
    />
  );
}

function Badge({ ann, number, onSelect }) {
  const interactive = typeof onSelect === "function";

  return (
    <button
      type="button"
      data-fixea-ui
      data-fixea-id={ann.id}
      aria-label={`Abrir ticket ${number}`}
      title={`Abrir ticket ${number}`}
      onClick={interactive ? () => onSelect(ann) : undefined}
      className={`fixea-pin-badge${ann.type === "pin" ? "" : " fixea-pin-small"}${
        interactive ? " fixea-pin-action" : ""
      }`}
      style={{ left: ann.coords.x, top: ann.coords.y, "--fixea-c": ann.color }}
    >
      {number}
    </button>
  );
}

function ToolBtn({ tool, mode, color, onClick, title, domId, children }) {
  const active = !!tool && mode === tool;
  const glow = tool === "erase" ? "#00e5ff" : color;
  return (
    <button
      type="button"
      id={domId || (tool ? `fixea-tool-${tool}` : undefined)}
      data-fixea-tool={tool || undefined}
      title={title}
      aria-label={title}
      onClick={onClick}
      style={
        active
          ? {
              color: glow,
              filter: `drop-shadow(0 0 6px ${glow})`,
              boxShadow: `0 0 12px ${glow}55`,
            }
          : undefined
      }
      className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-all ${
        active
          ? "bg-white/10"
          : "text-slate-300 hover:bg-white/5 hover:text-cyan-400"
      }`}
    >
      {children}
    </button>
  );
}

// La paleta se monta en un portal para que ningún ancestro con overflow pueda
// recortarla. Se ubica a la izquierda del botón usando su rectángulo real.
function ColorPalette({ activeColor, onSelect, position }) {
  if (!position) return null;

  return createPortal(
    <div
      data-fixea-ui
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        transform: "translate(-100%, -50%)",
        zIndex: 80,
      }}
      className="flex flex-col items-center gap-2 rounded-full border border-cyan-400/60 bg-[#08090e] px-[7px] py-2.5 shadow-[0_0_20px_rgba(0,0,0,0.8)]"
    >
      {COLORS.map((colour) => (
        <button
          key={colour.value}
          type="button"
          title={colour.name}
          aria-label={`Color ${colour.name}`}
          onClick={() => onSelect(colour.value)}
          style={{
            backgroundColor: colour.value,
            boxShadow: `0 0 8px ${colour.value}`,
          }}
          className={`h-[18px] w-[18px] cursor-pointer rounded-full border-2 transition-transform ${
            activeColor === colour.value
              ? "scale-110 border-white"
              : "border-transparent hover:scale-110"
          }`}
        />
      ))}
    </div>,
    document.body,
  );
}

function ColorTool({
  tool,
  mode,
  color,
  activeColor,
  onSelectColor,
  onClick,
  title,
  domId,
  children,
}) {
  const buttonRef = useRef(null);
  const [position, setPosition] = useState(null);
  const open = mode === tool;

  // La posición se calcula solo mientras la paleta está abierta y se recalcula
  // ante resize o cualquier scroll (incluido el de contenedores internos).
  useIsomorphicLayoutEffect(() => {
    if (!open) {
      return undefined;
    }

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      setPosition({
        left: rect.left - 12,
        top: rect.top + rect.height / 2,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <div ref={buttonRef} className="relative">
      <ToolBtn
        tool={tool}
        mode={mode}
        color={color}
        onClick={onClick}
        title={title}
        domId={domId}
      >
        {children}
      </ToolBtn>
      {open && (
        <ColorPalette
          activeColor={activeColor}
          onSelect={onSelectColor}
          position={position}
        />
      )}
    </div>
  );
}

export default function ClientToolbar({
  activeTool,
  setActiveTool,
  activeColor,
  onColorChange,
  canvasRef,
  onReset,
  onAddTicket,
  onDeleteTicket,
  onSelectTicket,
  linkedTicketIds,
  projectId,
  projectName,
}) {
  const router = useRouter();
  const pathname = usePathname();

  // La herramienta vive en la página para que el cursor del canvas y la barra
  // compartan un único estado. Sin herramienta activa, el clic crea un pin.
  const mode = activeTool ?? null;
  const setMode = setActiveTool;

  const [mounted, setMounted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [preview, setPreview] = useState(null);
  const [modal, setModal] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // El gesto vive en un ref: el pointerup puede llegar antes que el render del
  // pointerdown, y sin esto un clic rápido no abriría el modal.
  const gestureRef = useRef(null);
  const [suppressClickUntil, setSuppressClickUntil] = useState(0);

  const key = mounted ? pageKey() : "";
  const linkedIds = useMemo(
    () => new Set((linkedTicketIds || []).map((id) => String(id))),
    [linkedTicketIds],
  );
  const visible = useMemo(() => {
    // Si la página nos pasa los ids reales de la base, ocultamos las anotaciones
    // guardadas solo en localStorage que ya no tienen ticket (huérfanas).
    const isLinked = (ticket) =>
      !onSelectTicket ||
      linkedIds.has(String(ticket.id)) ||
      (ticket._id != null && linkedIds.has(String(ticket._id)));

    return tickets
      .filter((t) => t.coords && (!t.url || t.url === key) && isLinked(t))
      .map((t, i) => {
        const ann = {
          ...t,
          type: t.type || "pin",
          color: t.color || COLORS[0].value,
          number: t.number ?? i + 1,
        };
        // Tickets viejos guardados como "grid" ahora se muestran como desenfoque.
        if (ann.type === "grid") ann.type = "blur";
        if (ann.type !== "pin" && !ann.shape) ann.type = "pin";
        return ann;
      });
  }, [tickets, key, linkedIds, onSelectTicket]);
  const pendingItem = useMemo(
    () =>
      modal && !visible.some((v) => v.id === modal.ann.id)
        ? { ...modal.ann, number: tickets.length + 1 }
        : null,
    [modal, visible, tickets.length],
  );
  const items = useMemo(
    () => (pendingItem ? [...visible, pendingItem] : visible),
    [pendingItem, visible],
  );

  // Evita el warning de renderizado asíncrono en Next.js
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setMounted(true);
      setTickets(readTickets());
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("fixea-drawing", COLOR_TOOLS.includes(mode));
    root.classList.toggle("fixea-erasing", mode === "erase");
    return () => root.classList.remove("fixea-drawing", "fixea-erasing");
  }, [mode]);

  useEffect(() => {
    // Sin herramienta seleccionada el clic funciona como pin: marca un punto
    // y abre el modal de reporte en esa posición.
    const tool = mode || "pin";

    const isUI = (t) => t instanceof Element && !!t.closest("[data-fixea-ui]");

    const onDown = (e) => {
      // La goma no crea anotaciones: su acción vive en el handler de click.
      if (e.button !== 0 || mode === "erase" || isUI(e.target)) return;

      // Solo se anota dentro de la captura: el resto de la página queda libre.
      const canvas = canvasRef?.current;
      if (canvas && !(e.target instanceof Node && canvas.contains(e.target))) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setModal(null);

      // Posición del clic en coordenadas del documento. El pin y el modal se
      // anclan ahí, así quedan pegados a la captura aunque se scrollee.
      const x = Math.round(e.pageX);
      const y = Math.round(e.pageY);

      const nextGesture = {
        id: Date.now(),
        type: tool,
        color: activeColor,
        x0: x,
        y0: y,
        x,
        y,
        points: [[x, y]],
        dragging: false,
      };

      gestureRef.current = nextGesture;
    };

    const onMove = (e) => {
      const current = gestureRef.current;
      if (!current) return;
      const x = Math.round(e.pageX);
      const y = Math.round(e.pageY);

      const isDragging = current.dragging || Math.hypot(x - current.x0, y - current.y0) >= MIN_DRAG;
      const updatedPoints = [...current.points];

      if (current.type === "highlight") {
        const last = updatedPoints[updatedPoints.length - 1];
        if (Math.hypot(x - last[0], y - last[1]) >= 3) {
          updatedPoints.push([x, y]);
        }
      }

      const nextGesture = { ...current, x, y, dragging: isDragging, points: updatedPoints };
      gestureRef.current = nextGesture;

      if (DRAG_TOOLS.includes(current.type) && isDragging) {
        setPreview(buildAnnotation(nextGesture));
      }
    };

    const onUp = (e) => {
      const current = gestureRef.current;
      if (!current) return;
      e.preventDefault();
      e.stopPropagation();

      setSuppressClickUntil(performance.now() + 400);
      setPreview(null);
      setSubmitted(false);
      setModal({ ann: buildAnnotation(current), at: { x: current.x, y: current.y } });
      gestureRef.current = null;
      setMode(null);
    };

    const onCancel = () => {
      gestureRef.current = null;
      setPreview(null);
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onCancel, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onCancel, true);
    };
  }, [mode, activeColor, canvasRef, setMode]);

  const showToastMessage = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const removeTicketById = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        showToastMessage(
          data?.error || "No se pudo borrar el ticket. Intentá de nuevo.",
        );
        return;
      }
    } catch (err) {
      console.error("Error al borrar ticket en la API:", err);
      showToastMessage("No se pudo conectar con el servidor. Intentá de nuevo.");
      return;
    }

    const remaining = readTickets()
      .filter((t) => String(t.id) !== String(id))
      .map((t, i) => ({ ...t, number: i + 1 }));

    writeTickets(remaining);
    setTickets(remaining);
    if (onDeleteTicket) onDeleteTicket(id, remaining);
  }, [onDeleteTicket, showToastMessage]);

  useEffect(() => {
    const onClick = (e) => {
      if (e.target instanceof Element && e.target.closest("[data-fixea-ui]")) return;

      if (mode === "erase") {
        e.preventDefault();
        e.stopPropagation();

        const hit = hitTest(items, e.pageX, e.pageY);
        if (!hit) return;

        if (modal && hit.id === modal.ann.id && !readTickets().some((t) => String(t.id) === String(hit.id))) {
          setModal(null);
          if (onReset) onReset();
        } else {
          removeTicketById(hit.id);
        }
        return;
      }

      if (performance.now() < suppressClickUntil || COLOR_TOOLS.includes(mode)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [mode, modal, items, suppressClickUntil, onReset, removeTicketById]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      gestureRef.current = null;
      setPreview(null);
      setMode(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setMode]);

  const toggleTool = (tool) => setMode((m) => (m === tool ? null : tool));

  const handleUndo = () => {
    setMode(null);

    if (pendingItem) {
      setModal(null);
      if (onReset) onReset();
      return;
    }
    const last = visible[visible.length - 1];
    if (!last) {
      showToastMessage("No hay nada para deshacer");
      return;
    }
    removeTicketById(last.id);
  };

  const handleSendTickets = () => {
    setMode(null);

    if (readTickets().length === 0) {
      showToastMessage("No hay tickets para enviar");
      return;
    }
    showToastMessage("Tickets enviados con éxito");

    setTimeout(() => {
      if (pathname === "/") {
        window.dispatchEvent(new Event("fixea:tickets-updated"));
        router.refresh();
      } else {
        router.push("/");
      }
    }, 900);
  };

  const closeModal = () => {
    setModal(null);
    setSubmitted(false);
    if (onReset) onReset();
  };

  const handleSend = async ({ title, author, priority }) => {
    if (!modal || submitted || !title?.trim()) return;

    setSubmitted(true);
    const { ann } = modal;

    const newTicket = {
      id: ann.id,
      number: tickets.length + 1,
      type: ann.type,
      color: ann.color,
      shape: ann.shape,
      project:
        projectName?.trim() ||
        localStorage.getItem("fixea_project") ||
        window.location.hostname,
      projectId: projectId || null,
      title: title.trim(),
      priority: priority || "Alta",
      status: "PENDIENTE",
      author: author?.trim() || "Cliente",
      coords: ann.coords,
      url: pageKey(),
      createdAt: new Date().toISOString(),
    };

    let res;
    try {
      res = await fetch(`/api/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTicket),
      });
    } catch (err) {
      console.error("Error de conexión con la API, guardando en localStorage:", err);

      const updated = [...readTickets(), newTicket];
      writeTickets(updated);
      setTickets(updated);
      if (onAddTicket) onAddTicket(newTicket);

      setTimeout(() => {
        setSubmitted(false);
        setModal(null);
        setToastMessage("Guardado localmente (offline)");
      }, 1000);
      return;
    }

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      console.error("La API rechazó el ticket:", data?.error || res.status);
      setSubmitted(false);
      showToastMessage(
        data?.error || "No se pudo guardar el ticket. Intentá de nuevo.",
      );
      return;
    }

    const savedTicket = data.ticket || newTicket;

    const updated = [...readTickets(), savedTicket];
    writeTickets(updated);
    setTickets(updated);

    if (onAddTicket) onAddTicket(savedTicket);

    // Avisa a la página para que refresque los ids reales de la base.
    window.dispatchEvent(new Event("fixea:tickets-updated"));

    setTimeout(() => {
      setSubmitted(false);
      setModal(null);
      showToastMessage("¡Ticket guardado en la base de datos!");
    }, 1000);
  };

  const MODAL_WIDTH = 340;
  const MODAL_HEIGHT = 420;
  const TOOLBAR_RESERVE = 104;
  const MODAL_GAP = 20;

  let modalLeft = 0;
  let modalTop = 0;
  if (modal) {
    const viewportLeft = window.scrollX;
    const viewportTop = window.scrollY;
    const viewportRight = window.scrollX + window.innerWidth;
    const viewportBottom = window.scrollY + window.innerHeight;
    const minLeft = viewportLeft + 12;
    const maxLeft = viewportRight - MODAL_WIDTH - TOOLBAR_RESERVE;

    // Por defecto el modal se abre a la izquierda del pin para no tapar la toolbar.
    const leftOfPin = modal.at.x - MODAL_WIDTH - MODAL_GAP;
    const rightOfPin = modal.at.x + MODAL_GAP;
    const preferredLeft = leftOfPin >= minLeft ? leftOfPin : rightOfPin;

    modalLeft = Math.max(Math.min(preferredLeft, maxLeft), minLeft);
    modalTop = Math.max(
      Math.min(modal.at.y - 60, viewportBottom - MODAL_HEIGHT - 12),
      viewportTop + 12,
    );
  }
  const reportType =
    modal?.ann.type === "sticker"
      ? "REPORTAR SUGERENCIA"
      : "REPORTAR PROBLEMA";

  return (
    <>
      <style>{FIXEA_CSS}</style>

      {mounted &&
        createPortal(
          <>
            {items.map((a) => (
              <BlurOverlay key={`blur-${a.id}`} ann={a} />
            ))}
            {preview && <BlurOverlay ann={preview} />}

            <svg
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: 1,
                height: 1,
                overflow: "visible",
                pointerEvents: "none",
                zIndex: 20,
              }}
            >
              {items.map((a) => (
                <ShapeView key={a.id} ann={a} />
              ))}
              {preview && <ShapeView ann={preview} />}
            </svg>

            {items.map((a) => (
              <Badge
                key={`badge-${a.id}`}
                ann={a}
                number={a.number}
                onSelect={onSelectTicket}
              />
            ))}

            {modal && (
              <ReportTicketModal
                left={modalLeft}
                top={modalTop}
                reportType={reportType}
                submitted={submitted}
                onSend={handleSend}
                onClose={closeModal}
              />
            )}
          </>,
          document.body
        )}

      {toastMessage && (
        <div
          data-fixea-ui
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold px-5 py-3 rounded-full text-xs shadow-[0_0_20px_rgba(0,229,255,0.4)] backdrop-blur-md animate-in fade-in zoom-in-95"
        >
          {toastMessage}
        </div>
      )}

      {/* 1. ESTADO MINIMIZADO: botón flotante abajo a la derecha */}
      {!isExpanded && (
        <button
          type="button"
          data-fixea-ui
          id="fixea-expand-btn"
          onClick={() => setIsExpanded(true)}
          aria-label="Mostrar herramientas"
          title="Mostrar herramientas"
          className="fixea-toolbar-expand pointer-events-auto fixed bottom-6 right-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-cyan-400/60 bg-[#141824] text-white shadow-[0_0_20px_rgba(0,229,255,0.45),0_0_38px_rgba(255,0,127,0.25)] transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={3} />
        </button>
      )}

      {/* 2. ESTADO DESPLEGADO: barra vertical pegada a la derecha */}
      {isExpanded && (
        <div
          data-fixea-ui
          className="fixea-toolbar-expand pointer-events-auto fixed bottom-6 right-6 z-[70] flex w-14 cursor-pointer flex-col items-center rounded-full border border-cyan-400/60 bg-[#0B0C10]/95 pb-2.5 pt-4 shadow-[0_0_24px_rgba(0,229,255,0.35),0_0_44px_rgba(255,0,127,0.22)] backdrop-blur-md"
        >
        <div className="relative flex flex-col items-center gap-3">
            {/* 1. Goma */}
            <ToolBtn tool="erase" mode={mode} color={activeColor} domId="fixea-eraser-btn" title="Goma" onClick={() => toggleTool("erase")}>
              <Eraser className="w-[18px] h-[18px]" />
            </ToolBtn>

            {/* 2. Deshacer */}
            <ToolBtn domId="fixea-undo-btn" title="Deshacer" onClick={handleUndo}>
              <RotateCcw className="w-[18px] h-[18px]" />
            </ToolBtn>

            {/* 3. Desenfoque / Censurar */}
            <ColorTool tool="blur" mode={mode} color={activeColor} activeColor={activeColor} onSelectColor={onColorChange} domId="fixea-blur-btn" title="Desenfoque / Censurar" onClick={() => toggleTool("blur")}>
              <BlurIcon />
            </ColorTool>

            {/* 4. Flecha */}
            <ColorTool tool="arrow" mode={mode} color={activeColor} activeColor={activeColor} onSelectColor={onColorChange} title="Flecha" onClick={() => toggleTool("arrow")}>
              <ArrowRight className="w-[18px] h-[18px]" />
            </ColorTool>

            {/* 5. Resaltador */}
            <ColorTool tool="highlight" mode={mode} color={activeColor} activeColor={activeColor} onSelectColor={onColorChange} title="Resaltador" onClick={() => toggleTool("highlight")}>
              <Highlighter className="w-[18px] h-[18px]" />
            </ColorTool>

            {/* 6. Trazado / Lápiz */}
            <ColorTool tool="pin" mode={mode} color={activeColor} activeColor={activeColor} onSelectColor={onColorChange} domId="fixea-pin-btn" title="Trazado / Lápiz" onClick={() => toggleTool("pin")}>
              <Pencil className="w-[18px] h-[18px]" />
            </ColorTool>

            {/* 7. Nota / Sticker */}
            <ColorTool tool="sticker" mode={mode} color={activeColor} activeColor={activeColor} onSelectColor={onColorChange} title="Nota / Sticker" onClick={() => toggleTool("sticker")}>
              <StickyNote className="w-[18px] h-[18px]" />
            </ColorTool>

            {/* 8. Enviar todo */}
            <ToolBtn domId="fixea-send-trigger-btn" title="Enviar todo" onClick={handleSendTickets}>
              <Send className="w-[18px] h-[18px]" />
            </ToolBtn>

            {/* 9. Minimizar */}
            <button
              type="button"
              id="fixea-minimize-btn"
              onClick={() => {
                setIsExpanded(false);
                setMode(null);
                gestureRef.current = null;
                setPreview(null);
              }}
              aria-label="Minimizar barra"
              title="Minimizar"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Minus className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
