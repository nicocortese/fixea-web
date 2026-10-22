"use client";
import { useState, useEffect } from "react";

import {
  X,
  Link2,
  Code2,
  Monitor,
  Globe,
  Folder,
  Clock,
  Lightbulb,
  ChevronDown,
  Send,
  CheckCircle2,
} from "lucide-react";
import { formatDateTime } from "@/lib/formatDate";

export default function TicketModal({
  isOpen,
  onClose,
  ticket,
  updateEstado,
  onTicketUpdated,
}) {
  const [devResponse, setDevResponse] = useState("");
  const [ticketStatus, setTicketStatus] = useState("PENDIENTE");
  const [emailSent, setEmailSent] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const [loadedTicketId, setLoadedTicketId] = useState(null);
  const [resolutionHistory, setResolutionHistory] = useState([]);

  if (isOpen && ticket?.id && loadedTicketId !== ticket.id) {
    setLoadedTicketId(ticket.id);
    setDevResponse(ticket.devNote || "");
    setNoteError(null);
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

      setEmailSent(true);

      setTimeout(() => {
        setEmailSent(false);
        if (onClose) onClose();
      }, 2000);
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
        : "#00FF66";

  const screenshot =
    ticket?.screenshotUrl || ticket?.screenshot || ticket?.imageUrl || null;
  const projectInitial = (ticket?.project || "F").charAt(0).toUpperCase();
  const codeSnippet =
    ticket?.metadata?.selector || ticket?.selector || ticket?.code || null;
  const screenResolution =
    ticket?.metadata?.screenResolution || ticket?.screen || null;
  const browserInfo = ticket?.metadata?.browserInfo || ticket?.browser || null;
  const pageUrl = ticket?.metadata?.url || ticket?.url || null;
  const isLinkablePageUrl = /^https?:\/\//i.test(pageUrl || "");
  const formattedCreatedAt = formatDateTime(ticket?.createdAt);
  const formattedUpdatedAt = formatDateTime(ticket?.updatedAt);

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

        {/* Imagen con altura más chica (h-36) para que no empuje el contenido */}
        <div className="w-full h-36 bg-slate-950 border-b border-slate-800 relative overflow-hidden">
          {screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshot}
              alt="Captura técnica"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#1F2029,#0B0C10)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-base font-black text-[#00E5FF]">
                {projectInitial}
              </span>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <h2 className="text-base font-bold text-white mb-3">
            <span className="font-normal text-slate-300">Proyecto:</span>
            <span className="font-extrabold text-white text-lg">
              {ticket?.project || "Sin proyecto"}
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Columna izquierda */}
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl border border-slate-800 bg-[#1F2029] flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-xs text-white leading-tight italic">
                  {ticket?.title || "Sin descripción"}
                </p>
              </div>

              <div className="bg-[#1F2029] border border-slate-800 px-3 py-2 rounded-xl flex items-center justify-between text-xs text-white">
                <span className="flex items-center gap-2 font-medium uppercase text-slate-200">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-slate-300" />
                  {ticket?.status || ticketStatus}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              <div className="rounded-xl px-3 py-2 border border-slate-800 bg-[#1F2029] flex items-center justify-between text-xs text-white">
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

            {/* Columna derecha */}
            <div className="space-y-2 text-xs text-slate-400">
              {pageUrl && (
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  {isLinkablePageUrl ? (
                    <a
                      href={pageUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={pageUrl}
                      className="block min-w-0 flex-1 truncate font-mono text-slate-300 hover:text-[#00E5FF]"
                    >
                      {pageUrl}
                    </a>
                  ) : (
                    <span
                      title={pageUrl}
                      className="block min-w-0 flex-1 truncate font-mono text-slate-300"
                    >
                      {pageUrl}
                    </span>
                  )}
                </div>
              )}

              {codeSnippet && (
                <div className="flex items-start gap-2">
                  <Code2 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span className="font-mono text-[10px] text-white bg-slate-900 p-1.5 rounded-lg border border-slate-800 break-all">
                    {codeSnippet}
                  </span>
                </div>
              )}

              {screenResolution && (
                <div className="flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{screenResolution}</span>
                </div>
              )}

              {browserInfo && (
                <div className="flex items-start gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span
                    title={browserInfo}
                    className="break-all line-clamp-2"
                  >
                    {browserInfo}
                  </span>
                </div>
              )}

              {ticket?.path && (
                <div className="flex items-center gap-2">
                  <Folder className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-mono text-white">{ticket.path}</span>
                </div>
              )}

              {formattedCreatedAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Creado: {formattedCreatedAt}</span>
                </div>
              )}

              {formattedUpdatedAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Actualizado: {formattedUpdatedAt}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sección de resolución técnica del programador (Opción A) */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="text-[12px] font-bold text-[#F1F5F9] flex items-center justify-between">
              <span className="text-[#00E5FF]">Resolución técnica</span>
              <span className="text-slate-500 text-[10px]">Cambios</span>
            </div>

            <div className="bg-[#1F2029] border border-slate-800 rounded-xl p-2 text-xs space-y-1 max-h-20 overflow-y-auto">
              {resolutionHistory.length === 0 && (
                <p className="text-[11px] italic text-slate-500">
                  Todavía no hay notas técnicas.
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

            <form onSubmit={handleFix} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={devResponse}
                  onChange={(e) => setDevResponse(e.target.value)}
                  disabled={savingNote}
                  placeholder="Explicá la corrección para que el cliente la vea..."
                  className="flex-1 bg-[#1F2029] border border-slate-800 rounded-xl px-3 py-2 text-xs text-[#f1f5f9] placeholder-slate-500 focus:outline-none focus:border-[#00E5FF] disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={savingNote || !devResponse.trim()}
                  className="px-4 py-2 bg-[#00E5FF] hover:bg-[#00E5FF] text-[#1F2029] rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,229,255,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="w-3 h-3" />
                  <span>{savingNote ? "Guardando..." : "Enviar"}</span>
                </button>
              </div>

              {noteError ? (
                <div className="flex items-center gap-2 text-[10px] text-[#FF003C] bg-[#0B0C10]/40 border border-[#FF003C]/40 rounded-xl px-3 py-2">
                  <span>{noteError}</span>
                </div>
              ) : emailSent ? (
                <div className="flex items-center gap-2 text-[10px] text-[#00E5FF] bg-[#00FF66]/10 border border-[#00FF66]/30 rounded-xl px-3 py-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Corrección enviada. Se notificó al cliente para su revisión.
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic text-center pt-1">
                  Al enviar la solución, el ticket pasa a En Proceso a la espera de validación del cliente.
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
