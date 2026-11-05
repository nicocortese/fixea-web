"use client";

import { ChevronDown, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/formatDate";

const PRIORITY_CONFIG = {
  Alta: {
    text: "#FF003C",
    dotBg: "#FF003C",
    glow: "0 0 10px #FF003C",
  },
  Media: {
    text: "#FFEA00",
    dotBg: "#FFEA00",
    glow: "0 0 10px #FFEA00",
  },
  Baja: {
    text: "#00FF66",
    dotBg: "#00FF66",
    glow: "0 0 10px #00FF66",
  },
};

export default function TicketCard({ ticket, onClick, className = "" }) {
  const title = ticket?.title?.trim() || "Sin descripción";
  const author = ticket?.author?.trim() || "Cliente";
  const priority = ticket?.priority || "Baja";
  const initial = author.charAt(0).toUpperCase();
  const screenshot =
    ticket?.screenshotUrl || ticket?.screenshot || ticket?.imageUrl || null;
  const projectInitial = (ticket?.project || "F").charAt(0).toUpperCase();
  const formattedCreatedAt = formatDateTime(ticket?.createdAt);
  const formattedUpdatedAt = formatDateTime(ticket?.updatedAt);
  const hasUpdate =
    formattedUpdatedAt && formattedUpdatedAt !== formattedCreatedAt;
  const priorityConfig = PRIORITY_CONFIG[priority] || {
    text: "#94a3b8",
    dotBg: "#94a3b8",
    glow: "0 0 10px #94a3b8",
  };

  return (
    // Toda la tarjeta abre el detalle: no hay ventanas externas ni botones
    // de link que intercepten el clic del Kanban.
    <article
      onClick={onClick}
      className={`flex min-w-0 cursor-pointer select-none flex-col overflow-hidden rounded-xl border bg-[#0B0C10] hover:-translate-y-0.5 ${className}`}
    >
      {/* Encabezado: avatar + cliente */}
      <div className="flex items-center gap-2 bg-[#F1F5F9] px-3 py-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#334155,#1F2029)] text-[10px] font-black text-white ring-1 ring-white/40">
          {initial}
        </div>
        <span className="truncate text-[11px] font-bold text-[#0F121D]">
          {author}
        </span>
      </div>

      {/* Vista previa */}
      <div className="relative h-28 w-full border-b border-[#1F2029] bg-[#1F2029]">
        {screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshot}
            alt={`Vista previa del reporte de ${author}`}
            className="h-full w-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#1F2029,#0B0C10)]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-sm font-black text-[#00E5FF]">
              {projectInitial}
            </span>
          </div>
        )}
      </div>

      {/* Prioridad */}
      <div className="mx-2 mt-2 flex h-8 items-center justify-between rounded-lg border border-[#3A3B45] bg-[#1F2029] px-2.5">
        <span className="text-[11px] text-slate-300">Prioridad</span>

        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full transition-all"
            style={{
              backgroundColor: priorityConfig.dotBg,
              boxShadow: priorityConfig.glow,
            }}
          />
          <span
            className="text-[11px] font-bold"
            style={{ color: priorityConfig.text }}
          >
            {priority}
          </span>
          <ChevronDown className="ml-0.5 h-3.5 w-3.5 text-[#F1F5F9]" />
        </div>
      </div>

      {/* Título / sugerencia */}
      <p className="line-clamp-2 min-h-12 px-3 pb-2 pt-2 text-[11px] leading-snug text-[#E5E7EB]">
        {title}
      </p>

      {/* Fechas en hora de Argentina */}
      {(formattedCreatedAt || hasUpdate) && (
        <div className="flex flex-col gap-0.5 border-t border-[#1F2029] px-3 py-2 text-[10px] text-slate-500">
          {formattedCreatedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">{formattedCreatedAt}</span>
            </span>
          )}

          {hasUpdate && (
            <span className="truncate pl-4 text-slate-600">
              Act. {formattedUpdatedAt}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
