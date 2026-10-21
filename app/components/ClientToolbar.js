"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus,
  Eraser,
  RotateCcw,
  Grid,
  ArrowRight,
  Highlighter,
  PenTool,
  StickyNote,
  Send,
  Minus,
  Lightbulb,
  Monitor,
  CheckCircle2,
  X,
} from "lucide-react";

const STORAGE_KEY = "fixea_custom_tickets";

const COLORS = [
  { value: "#00e5ff", name: "Cian" },
  { value: "#ff007f", name: "Magenta" },
  { value: "#7000FF", name: "Violeta" },
];
const COLOR_TOOLS = ["pin", "arrow", "highlight", "grid", "sticker"];
const DRAG_TOOLS = ["arrow", "highlight", "grid"];
const TOOL_LABEL = {
  pin: "Pluma",
  arrow: "Flecha",
  highlight: "Resaltador",
  grid: "Cuadrícula",
  sticker: "Nota",
};
const MIN_DRAG = 8;
const GRID_STEP = 24;

const ERASER_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='white' stroke='%2300e5ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3a1 1 0 0 1 0-1.4l13-13a1 1 0 0 1 1.4 0l4.3 4.3a1 1 0 0 1 0 1.4l-13 13a1 1 0 0 1-1.4 0z'/><path d='M22 21H7'/><path d='m5 11 9 9'/></svg>") 4 20, not-allowed`;

const FIXEA_CSS = `
html.fixea-drawing, html.fixea-drawing * { cursor: crosshair !important; user-select: none !important; }
html.fixea-drawing [data-fixea-ui], html.fixea-drawing [data-fixea-ui] * { cursor: pointer !important; }
html.fixea-drawing textarea[data-fixea-ui] { cursor: text !important; user-select: text !important; }

html.fixea-erasing, html.fixea-erasing * { cursor: ${ERASER_CURSOR} !important; }
html.fixea-erasing [data-fixea-ui], html.fixea-erasing [data-fixea-ui] * { cursor: pointer !important; }
html.fixea-erasing textarea[data-fixea-ui] { cursor: text !important; }

.fixea-pin-badge {
  position: absolute; z-index: 45;
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
.fixea-shape { filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.45)); }

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
    case "grid": {
      const s = g.dragging
        ? { x: Math.min(x0, x), y: Math.min(y0, y), w: Math.abs(x - x0), h: Math.abs(y - y0) }
        : { x: cl(x0 - 72), y: cl(y0 - 72), w: 144, h: 144 };
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
    case "grid":
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
  if (!s || ann.type === "pin") return null;

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

  if (ann.type === "grid") {
    let d = "";
    for (let gx = s.x + GRID_STEP; gx < s.x + s.w; gx += GRID_STEP) d += `M${gx} ${s.y}V${s.y + s.h}`;
    for (let gy = s.y + GRID_STEP; gy < s.y + s.h; gy += GRID_STEP) d += `M${s.x} ${gy}H${s.x + s.w}`;
    return (
      <g className="fixea-shape" data-fixea-id={ann.id}>
        <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={2} fill={c} fillOpacity={0.08} stroke={c} strokeWidth={2} />
        {d && <path d={d} fill="none" stroke={c} strokeOpacity={0.6} strokeWidth={1} />}
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

function Badge({ ann, number }) {
  return (
    <div
      className={`fixea-pin-badge${ann.type === "pin" ? "" : " fixea-pin-small"}`}
      data-fixea-id={ann.id}
      style={{ left: ann.coords.x, top: ann.coords.y, "--fixea-c": ann.color }}
    >
      {number}
    </div>
  );
}

function ToolBtn({ tool, mode, color, onClick, title, domId, children }) {
  const active = !!tool && mode === tool;
  const glow = tool === "erase" ? "#00e5ff" : color;
  return (
    <button
      type="button"
      id={domId}
      title={title}
      onClick={onClick}
      style={active ? { color: glow, filter: `drop-shadow(0 0 4px ${glow})` } : undefined}
      className={`p-1 transition-colors ${active ? "" : "text-slate-300 hover:text-cyan-400"}`}
    >
      {children}
    </button>
  );
}

export default function ClientToolbar({ setPinningActive, onReset, onAddTicket, onDeleteTicket }) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [activeColor, setActiveColor] = useState(COLORS[0].value);
  const [tickets, setTickets] = useState([]);
  const [preview, setPreview] = useState(null);
  const [modal, setModal] = useState(null);
  const [ticketTitle, setTicketTitle] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [gesture, setGesture] = useState(null);
  const [suppressClickUntil, setSuppressClickUntil] = useState(0);

  const key = mounted ? pageKey() : "";
  const visible = useMemo(
    () =>
      tickets
        .filter((t) => t.coords && (!t.url || t.url === key))
        .map((t, i) => {
          const ann = {
            ...t,
            type: t.type || "pin",
            color: t.color || COLORS[0].value,
            number: t.number ?? i + 1,
          };
          if (ann.type !== "pin" && !ann.shape) ann.type = "pin";
          return ann;
        }),
    [tickets, key],
  );
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
    if (setPinningActive) setPinningActive(false);
  }, [mode, setPinningActive]);

  useEffect(() => {
    if (!COLOR_TOOLS.includes(mode)) return;

    const isUI = (t) => t instanceof Element && !!t.closest("[data-fixea-ui]");

    const onDown = (e) => {
      if (e.button !== 0 || isUI(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      setModal(null);

      const x = Math.round(e.pageX);
      const y = Math.round(e.pageY);
      setGesture({
        id: Date.now(),
        type: mode,
        color: activeColor,
        x0: x,
        y0: y,
        x,
        y,
        points: [[x, y]],
        dragging: false,
      });
    };

    const onMove = (e) => {
      if (!gesture) return;
      const x = Math.round(e.pageX);
      const y = Math.round(e.pageY);

      const isDragging = gesture.dragging || Math.hypot(x - gesture.x0, y - gesture.y0) >= MIN_DRAG;
      const updatedPoints = [...gesture.points];

      if (gesture.type === "highlight") {
        const last = updatedPoints[updatedPoints.length - 1];
        if (Math.hypot(x - last[0], y - last[1]) >= 3) {
          updatedPoints.push([x, y]);
        }
      }

      const nextGesture = { ...gesture, x, y, dragging: isDragging, points: updatedPoints };
      setGesture(nextGesture);

      if (DRAG_TOOLS.includes(gesture.type) && isDragging) {
        setPreview(buildAnnotation(nextGesture));
      }
    };

    const onUp = (e) => {
      if (!gesture) return;
      e.preventDefault();
      e.stopPropagation();

      setSuppressClickUntil(performance.now() + 400);
      setPreview(null);
      setTicketTitle("");
      setModal({ ann: buildAnnotation(gesture), at: { x: gesture.x, y: gesture.y } });
      setGesture(null);
      setMode(null);
    };

    const onCancel = () => {
      setGesture(null);
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
  }, [mode, activeColor, gesture]);

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
      setGesture(null);
      setPreview(null);
      setMode(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
    if (onReset) onReset();
  };

  const handleSend = async () => {
    if (!modal || submitted || !ticketTitle.trim()) return;

    setSubmitted(true);
    const { ann } = modal;

    const newTicket = {
      id: ann.id,
      number: tickets.length + 1,
      type: ann.type,
      color: ann.color,
      shape: ann.shape,
      project:
        (typeof window !== "undefined" &&
          window.localStorage.getItem("fixea_project")) ||
        (typeof window !== "undefined" ? window.location.hostname : "Fixea"),
      title: ticketTitle.trim(),
      priority: "Alta",
      status: "PENDIENTE",
      author: "Cliente",
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
        setTicketTitle("");
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

    setTimeout(() => {
      setSubmitted(false);
      setModal(null);
      setTicketTitle("");
      showToastMessage("¡Ticket guardado en la base de datos!");
    }, 1000);
  };

  const modalLeft = modal
    ? Math.max(Math.min(modal.at.x + 24, window.scrollX + window.innerWidth - 400), window.scrollX + 10)
    : 0;
  const modalTop = modal ? Math.max(modal.at.y - 40, window.scrollY + 20) : 0;
  const modalNumber = modal ? (pendingItem ? pendingItem.number : visible.find((v) => v.id === modal.ann.id)?.number) : null;

  return (
    <>
      <style>{FIXEA_CSS}</style>

      {mounted &&
        createPortal(
          <>
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
                zIndex: 40,
              }}
            >
              {items.map((a) => (
                <ShapeView key={a.id} ann={a} />
              ))}
              {preview && <ShapeView ann={preview} />}
            </svg>

            {items.map((a) => (
              <Badge key={`badge-${a.id}`} ann={a} number={a.number} />
            ))}

            {modal && (
              <div
                data-fixea-ui
                style={{ left: modalLeft, top: modalTop }}
                className="absolute z-50 w-80 sm:w-96 bg-[#0B0C10] text-[#f1f5f9] rounded-3xl p-5 border border-cyan-400/80 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(0,229,255,0.3)] select-none"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-cyan-400">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    NUEVO TICKET #{modalNumber}
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-[#141824] rounded-xl p-2.5 mb-3 text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Herramienta:</span>
                    <span className="font-mono text-slate-300">{TOOL_LABEL[modal.ann.type] || "Pluma"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Punto seleccionado:</span>
                    <span className="font-mono text-cyan-300">
                      X: {modal.ann.coords.x}px | Y: {modal.ann.coords.y}px
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3 h-3 text-slate-500" /> Pantalla:
                    </span>
                    <span className="font-mono text-slate-300">
                      {window.innerWidth}x{window.innerHeight}
                    </span>
                  </div>
                </div>

                <textarea
                  data-fixea-ui
                  autoFocus
                  rows={3}
                  value={ticketTitle}
                  placeholder="Escribí tu observación aquí..."
                  onChange={(e) => setTicketTitle(e.target.value)}
                  className="w-full bg-[#141824] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none mb-3"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400">Prioridad:</span>
                    <span className="font-bold text-[#ff0055]">Alta</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSend}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-400 to-pink-500 hover:opacity-90 rounded-xl font-black text-xs text-black flex items-center gap-1.5 shadow-md transition-all"
                  >
                    {submitted ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> ¡ENVIADO!
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> ENVIAR TICKET
                      </>
                    )}
                  </button>
                </div>
              </div>
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

      {/* 1. BOTÓN [+] CERRADO */}
      {!isOpen && (
        <button
          type="button"
          data-fixea-ui
          onClick={() => {
            setIsOpen(true);
            setMode("pin");
          }}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-2xl bg-[#08090e] flex items-center justify-center border border-cyan-400/50 shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-6 h-6 text-white stroke-3" />
        </button>
      )}

      {/* 2. BARRA DESPLEGADA */}
      {isOpen && (
        <div
          data-fixea-ui
          className="fixed bottom-6 right-6 z-50 w-12 bg-[#08090e] rounded-full py-3 flex flex-col items-center gap-3 shadow-[0_0_25px_rgba(0,0,0,0.9)] border border-cyan-400/60 backdrop-blur-md"
        >
          {/* Selector de color */}
          {COLOR_TOOLS.includes(mode) && (
            <div
              data-fixea-ui
              className="absolute right-full mr-2.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 px-[7px] py-2.5 bg-[#08090e] border border-cyan-400/60 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.8)]"
            >
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  onClick={() => setActiveColor(c.value)}
                  style={{ backgroundColor: c.value, boxShadow: `0 0 8px ${c.value}` }}
                  className={`w-[18px] h-[18px] rounded-full border-2 transition-transform ${
                    activeColor === c.value ? "border-white scale-110" : "border-transparent hover:scale-110"
                  }`}
                />
              ))}
            </div>
          )}

          {/* 1. Goma */}
          <ToolBtn tool="erase" mode={mode} color={activeColor} domId="fixea-eraser-btn" title="Goma" onClick={() => toggleTool("erase")}>
            <Eraser className="w-4 h-4" />
          </ToolBtn>

          {/* 2. Deshacer */}
          <ToolBtn domId="fixea-undo-btn" title="Deshacer" onClick={handleUndo}>
            <RotateCcw className="w-4 h-4" />
          </ToolBtn>

          {/* 3. Cuadrícula */}
          <ToolBtn tool="grid" mode={mode} color={activeColor} title="Cuadrícula" onClick={() => toggleTool("grid")}>
            <Grid className="w-4 h-4" />
          </ToolBtn>

          {/* 4. Flecha */}
          <ToolBtn tool="arrow" mode={mode} color={activeColor} title="Flecha" onClick={() => toggleTool("arrow")}>
            <ArrowRight className="w-4 h-4" />
          </ToolBtn>

          {/* 5. Resaltador */}
          <ToolBtn tool="highlight" mode={mode} color={activeColor} title="Resaltador" onClick={() => toggleTool("highlight")}>
            <Highlighter className="w-4 h-4" />
          </ToolBtn>

          {/* 6. Pluma */}
          <ToolBtn tool="pin" mode={mode} color={activeColor} domId="fixea-pin-btn" title="Pluma / Crear Ticket" onClick={() => toggleTool("pin")}>
            <PenTool className="w-4 h-4" />
          </ToolBtn>

          {/* 7. Nota / Sticker */}
          <ToolBtn tool="sticker" mode={mode} color={activeColor} title="Nota / Sticker" onClick={() => toggleTool("sticker")}>
            <StickyNote className="w-4 h-4" />
          </ToolBtn>

          {/* 8. Enviar feedback */}
          <ToolBtn domId="fixea-send-trigger-btn" title="Enviar feedback" onClick={handleSendTickets}>
            <Send className="w-4 h-4" />
          </ToolBtn>

          <div className="w-4 h-[1px] bg-slate-800 my-1" />

          {/* 9. Colapsar */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setMode(null);
              setGesture(null);
              setPreview(null);
            }}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Colapsar"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}