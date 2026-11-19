"use client";
import { useState, useEffect } from "react";

import {
  X,
  Link2,
  Code2,
  Monitor,
  Folder,
  Clock,
  ChevronDown,
  Send,
  Copy,
  Check,
  ZoomIn,
} from "lucide-react";
import { formatDateTime } from "@/lib/formatDate";
import FixeaLoader from "./FixeaLoader";
import IdeaGlowIcon, { quoteComment } from "./IdeaGlowIcon";

// Verde esmeralda de la paleta FIXEA (prioridad Baja / tickets aprobados).
const FIXEA_GREEN = "#00FF66";

const STATUS_CONFIG = {
  PENDIENTE: { color: "#00E5FF" },
  EN_PROCESO: { color: "#FFEA00" },
  FINALIZADO: { color: FIXEA_GREEN },
};

function describeBrowser(userAgent) {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (!ua) return "";

  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Chrome\/|CriOS/i.test(ua)
          ? "Chrome"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Navegador";

  const os = /Windows NT/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(ua)
        ? "iOS"
        : /Mac OS X|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "";

  return os ? `${browser} · ${os}` : browser;
}

function formatResolution(value) {
  const match = /([\d.]+)\s*[x×]\s*([\d.]+)/i.exec(String(value || ""));
  if (!match) return "";
  return `${Math.round(Number(match[1]))} × ${Math.round(Number(match[2]))} px`;
}

// Ubica el pin dentro del lightbox usando la resolución de captura como
// referencia: las coords del ticket vienen en px del viewport original.
function getPinPosition(coords, screenResolution) {
  if (!coords || typeof coords.x !== "number" || typeof coords.y !== "number") {
    return null;
  }
  const match = /([\d.]+)\s*[x×]\s*([\d.]+)/i.exec(String(screenResolution || ""));
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;

  const left = Math.min(Math.max((coords.x / width) * 100, 0), 100);
  const top = Math.min(Math.max((coords.y / height) * 100, 0), 100);
  return { left, top };
}

export default function TicketModal({
  isOpen,
  onClose,
  ticket,
  updateEstado,
  onTicketUpdated,
  onSolutionSent,
}) {
  const [devResponse, setDevResponse] = useState("");
  const [ticketStatus, setTicketStatus] = useState("PENDIENTE");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const [loadedTicketId, setLoadedTicketId] = useState(null);
  const [resolutionHistory, setResolutionHistory] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copiedSelector, setCopiedSelector] = useState(false);

  if (isOpen && ticket?.id && loadedTicketId !== ticket.id) {
    setLoadedTicketId(ticket.id);
    setDevResponse(ticket.devNote || "");
    setNoteError(null);
    setLightboxOpen(false);
    setCopiedSelector(false);
    setResolutionHistory(
      ticket.devNote
        ? [{ author: "Programador", text: ticket.devNote, time: null }]
        : [],
    );
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Escape cierra primero el lightbox; si no está abierto, cierra el modal.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (lightboxOpen) {
        setLightboxOpen(false);
        return;
      }
      if (onClose) onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, lightboxOpen]);

  useEffect(() => {
    if (!copiedSelector) return undefined;
    const timer = setTimeout(() => setCopiedSelector(false), 1600);
    return () => clearTimeout(timer);
  }, [copiedSelector]);

  if (!isOpen) return null;

  const handleFix = async (e) => {
    e.preventDefault();

    const note = devResponse.trim();
    if (!note || savingNote) return;

    if (!ticket?.id) {
      setNoteError("No hay un ticket válido para guardar la nota.");
      return;
    }

    setSavingNote(true);
    setNoteError(null);

    try {
      const res = await fetch(
        `/api/tickets/${encodeURIComponent(ticket.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ devNote: note, status: "EN_PROCESO" }),
        },
      );
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo guardar la nota.");
      }

      setResolutionHistory((history) => [
        ...history,
        { author: "Programador", text: note, time: "Hace unos segundos" },
      ]);
      setDevResponse("");
      setTicketStatus("EN_PROCESO");

      if (onTicketUpdated) {
        onTicketUpdated(
          ticket.id,
          data.ticket || { ...ticket, devNote: note, status: "EN_PROCESO" },
        );
      }

      // La API ya confirmó el guardado: cerramos el modal y dejamos que el
      // dashboard muestre el toast de confirmación arriba al centro.
      if (onSolutionSent) onSolutionSent();
      if (onClose) onClose();
    } catch (error) {
      console.error("Error al guardar la nota del desarrollador:", error);
      setNoteError(error.message || "No se pudo guardar la nota.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleApprove = () => {
    if (updateEstado) {
      updateEstado(ticket.id, "FINALIZADO");
    }
    if (onClose) {
      onClose();
    }
  };

  const handleReopen = () => {
    if (updateEstado) {
      updateEstado(ticket.id, "PENDIENTE");
    }
    if (onClose) {
      onClose();
    }
  };

  const priority = ticket?.priority || "Baja";
  const priorityColor =
    priority === "Alta"
      ? "#FF003C"
      : priority === "Media"
        ? "#FFEA00"
        : FIXEA_GREEN;

  // PENDIENTE es informativo: no se puede cambiar desde acá (lo mueve el
  // programador al enviar la solución o el cliente al rechazarla).
  const displayStatus = String(ticket?.status || ticketStatus || "PENDIENTE")
    .trim()
    .toUpperCase();
  const isPendingStatus = displayStatus === "PENDIENTE";
  const statusConfig = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.PENDIENTE;

  const screenshot =
    ticket?.screenshotUrl || ticket?.screenshot || ticket?.imageUrl || null;
  const projectInitial = (ticket?.project || "F").charAt(0).toUpperCase();
  const codeSnippet =
    ticket?.metadata?.selector || ticket?.selector || ticket?.code || null;
  const screenResolution =
    ticket?.metadata?.screenResolution || ticket?.screen || null;
  const browserInfo = ticket?.metadata?.browserInfo || ticket?.browser || null;
  // Priorizamos la URL real de la captura (metadata.url) y caemos al targetUrl
  // del proyecto o a la URL plana del ticket que guarda la extensión.
  const pageUrl =
    ticket?.metadata?.url || ticket?.targetUrl || ticket?.url || null;
  const isLinkablePageUrl = /^https?:\/\//i.test(pageUrl || "");
  const formattedCreatedAt = formatDateTime(ticket?.createdAt);
  const formattedUpdatedAt = formatDateTime(ticket?.updatedAt);

  const browserLabel = describeBrowser(browserInfo);
  const resolutionLabel = formatResolution(screenResolution);
  const pinPosition = getPinPosition(ticket?.coords, screenResolution);

  const copySelector = async () => {
    if (!codeSnippet) return;
    try {
      await navigator.clipboard.writeText(codeSnippet);
      setCopiedSelector(true);
    } catch (error) {
      console.error("No se pudo copiar el selector:", error);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0C10]/80 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#1F2029] rounded-3xl overflow-hidden neon-border-gradient shadow-2xl relative my-auto"
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-slate-900 text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4 cursor-pointer" />
        </button>

        {/* Captura: abre un lightbox ampliado, nunca navega al sitio del cliente. */}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (screenshot) setLightboxOpen(true);
          }}
          disabled={!screenshot}
          aria-label={screenshot ? "Ampliar captura" : "Sin captura"}
          className="group relative block w-full h-32 bg-slate-950 border-b border-slate-800 overflow-hidden text-left disabled:cursor-default cursor-zoom-in"
        >
          {screenshot ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt="Captura técnica"
                className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <span className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 rounded-lg border border-[#2A2C38] bg-[#0B0C10]/85 px-2 py-1 text-[10px] font-semibold text-[#E5E7EB] opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.5)] backdrop-blur transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                <ZoomIn className="h-3 w-3 text-[#00E5FF]" />
                Ampliar captura
              </span>
            </>
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#1F2029,#0B0C10)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-base font-black text-[#00E5FF]">
                {projectInitial}
              </span>
            </span>
          )}
        </button>

        <div className="p-3 space-y-2">
          <h2 className="text-sm font-bold text-white mb-2">
            <span className="font-normal text-slate-300">Proyecto:</span>{" "}
            <span className="font-extrabold text-white text-base">
              {ticket?.project || "Sin proyecto"}
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-2">
            {/* Columna izquierda */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#1F2029] p-2.5">
                <span className="flex shrink-0 items-center justify-center rounded-lg border border-[#FFD600]/25 bg-[#FFD600]/10 p-1.5 shadow-[0_0_14px_rgba(255,214,0,0.18)]">
                  <IdeaGlowIcon className="h-5 w-5" />
                </span>
                <p className="min-w-0 break-words text-xs font-medium italic leading-snug text-white">
                  {quoteComment(ticket?.title)}
                </p>
              </div>

              <div
                className="rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs text-white"
                style={{
                  border: `1px solid ${statusConfig.color}59`,
                  backgroundColor: `${statusConfig.color}14`,
                  boxShadow:
                    displayStatus === "FINALIZADO"
                      ? `0 0 14px ${statusConfig.color}33`
                      : "none",
                }}
              >
                <span
                  className="flex items-center gap-2 font-medium uppercase"
                  style={{ color: statusConfig.color }}
                >
                  {isPendingStatus ? (
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      style={{ color: statusConfig.color }}
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeOpacity="0.25"
                        strokeWidth="3"
                      />
                      <path
                        d="M21 12a9 9 0 0 0-9-9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: statusConfig.color,
                        boxShadow: `0 0 8px ${statusConfig.color}`,
                      }}
                    />
                  )}
                  {displayStatus}
                </span>
                {!isPendingStatus && displayStatus !== "FINALIZADO" && (
                  <ChevronDown
                    className="w-3.5 h-3.5"
                    style={{ color: statusConfig.color }}
                  />
                )}
                {displayStatus === "FINALIZADO" && (
                  <Check
                    className="w-3.5 h-3.5"
                    style={{ color: statusConfig.color }}
                  />
                )}
              </div>

              <div className="rounded-xl px-2.5 py-1.5 border border-slate-800 bg-[#1F2029] flex items-center justify-between text-xs text-white">
                <span className="text-slate-400">Prioridad</span>
                <span
                  className="flex items-center gap-1.5 font-bold"
                  style={{ color: priorityColor }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: priorityColor,
                      boxShadow: `0 0 8px ${priorityColor}`,
                    }}
                  />
                  {priority}
                </span>
              </div>
            </div>

            {/* Columna derecha: panel de metadatos */}
            <div className="rounded-xl border border-[#2A2C38] bg-[#161822] p-3 space-y-2.5 text-xs">
              {pageUrl && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    URL
                  </p>
                  {isLinkablePageUrl ? (
                    <a
                      href={pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      title={pageUrl}
                      className="flex items-start gap-1.5 break-all font-mono text-[11px] leading-snug text-[#7FE9FF] hover:underline"
                    >
                      <Link2 className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                      <span className="min-w-0">{pageUrl}</span>
                    </a>
                  ) : (
                    <p
                      title={pageUrl}
                      className="flex items-start gap-1.5 break-all font-mono text-[11px] leading-snug text-slate-300"
                    >
                      <Link2 className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" />
                      <span className="min-w-0">{pageUrl}</span>
                    </p>
                  )}
                </div>
              )}

              {codeSnippet && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Elemento (Selector)
                  </p>
                  <div className="flex items-start gap-1.5 rounded-lg border border-[#252734] bg-[#0E0F14] px-2.5 py-1.5">
                    <code className="min-w-0 flex-1 break-all font-mono text-[10.5px] leading-snug text-[#E5E7EB]">
                      {codeSnippet}
                    </code>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        copySelector();
                      }}
                      title={copiedSelector ? "Copiado" : "Copiar selector"}
                      aria-label="Copiar selector"
                      className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-[#1A1C26] hover:text-[#00E5FF]"
                    >
                      {copiedSelector ? (
                        <Check className="h-3 w-3 text-[#00FF66]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {(browserLabel || resolutionLabel) && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Pantalla / Navegador
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                    <Monitor className="h-3 w-3 shrink-0 text-slate-500" />
                    <span className="truncate" title={browserInfo || undefined}>
                      {[browserLabel, resolutionLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </div>
              )}

              {(formattedCreatedAt || formattedUpdatedAt) && (
                <div className="space-y-1.5 border-t border-[#252734] pt-2.5 text-[10.5px] text-slate-400">
                  {formattedCreatedAt && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="h-3 w-3" />
                        Creado
                      </span>
                      <span className="text-right text-slate-300">
                        {formattedCreatedAt}
                      </span>
                    </div>
                  )}
                  {formattedUpdatedAt && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="h-3 w-3" />
                        Actualizado
                      </span>
                      <span className="text-right text-slate-300">
                        {formattedUpdatedAt}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {ticket?.path && (
                <div className="flex items-center gap-1.5 border-t border-[#252734] pt-2.5 text-[10.5px] text-slate-400">
                  <Folder className="h-3 w-3 shrink-0 text-slate-500" />
                  <span className="truncate font-mono">{ticket.path}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sección de resolución técnica del programador */}
          <div className="pt-2.5 border-t border-slate-800 space-y-2">
            <div className="text-[12px] font-bold text-[#F1F5F9] flex items-center justify-between">
              <span className="text-[#00E5FF]">Solución aplicada</span>
              <span className="text-slate-500 text-[10px]">Cambios</span>
            </div>

            {ticket?.status === "FINALIZADO" &&
              (ticket?.verifiedByName || ticket?.verifiedAt) && (
                <p
                  className="text-[10px] font-semibold"
                  style={{ color: FIXEA_GREEN }}
                >
                  Verificado
                  {ticket.verifiedByName
                    ? ` por ${ticket.verifiedByName}`
                    : ""}
                  {formatDateTime(ticket.verifiedAt)
                    ? ` · ${formatDateTime(ticket.verifiedAt)}`
                    : ""}
                </p>
              )}

            <div className="bg-[#1F2029] border border-slate-800 rounded-xl p-2 text-xs space-y-1 max-h-16 overflow-y-auto">
              {resolutionHistory.length === 0 && (
                <p className="text-[11px] italic text-slate-500">
                  Todavía no se envió una respuesta al cliente.
                </p>
              )}
              {resolutionHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-start gap-2"
                >
                  <span className="text-[#00E5FF] font-semibold text-[12px]">
                    {item.author}:
                  </span>
                  <p className="text-slate-300 flex-1 text-[12px] leading-tight">
                    {item.text}
                  </p>
                  {item.time && (
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {item.time}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleFix} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={devResponse}
                  onChange={(e) => setDevResponse(e.target.value)}
                  disabled={savingNote}
                  placeholder="Explicá la corrección para que el cliente la vea..."
                  className="flex-1 bg-[#1F2029] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-[#f1f5f9] placeholder-slate-500 focus:outline-none focus:border-[#00E5FF] disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={savingNote || !devResponse.trim()}
                  className="px-4 py-1.5 bg-[#00E5FF] hover:bg-[#00E5FF] text-[#1F2029] rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,229,255,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingNote ? (
                    <FixeaLoader size={12} />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  <span>{savingNote ? "Guardando…" : "Enviar"}</span>
                </button>
              </div>

              {noteError ? (
                <div className="flex items-center gap-2 text-[10px] text-[#FF003C] bg-[#0B0C10]/40 border border-[#FF003C]/40 rounded-xl px-3 py-2">
                  <span>{noteError}</span>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic text-center pt-1">
                  Al enviar la solución, el ticket pasa a En Proceso a la espera
                  de validación del cliente.
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Lightbox de la captura */}
        {lightboxOpen && screenshot && (
          <div
            onClick={(event) => {
              event.stopPropagation();
              setLightboxOpen(false);
            }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[#07080C]/90 p-4 backdrop-blur-sm"
          >
            <div
              onClick={(event) => event.stopPropagation()}
              className="relative max-h-[90vh] max-w-[92vw]"
            >
              <div className="relative overflow-hidden rounded-xl border border-[#2A2C38] bg-[#0B0C10] shadow-[0_20px_50px_rgba(0,0,0,0.75)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot}
                  alt="Captura ampliada"
                  className="max-h-[86vh] w-auto max-w-full object-contain"
                />
                {pinPosition && (
                  <span
                    className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#00E5FF] bg-[#00E5FF]/25 shadow-[0_0_16px_rgba(0,229,255,0.85)]"
                    style={{
                      left: `${pinPosition.left}%`,
                      top: `${pinPosition.top}%`,
                    }}
                  />
                )}
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxOpen(false);
                }}
                aria-label="Cerrar captura ampliada"
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#2A2C38] bg-[#161822] text-white shadow-lg transition-colors hover:bg-[#1F2029]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-400">
              ESC o clic afuera para cerrar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
