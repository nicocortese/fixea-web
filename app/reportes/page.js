"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import SectionShell, { Panel, StateMessage } from "../components/sections/SectionShell";
import useWorkspaceData from "../components/sections/useWorkspaceData";
import IdeaGlowIcon, { quoteComment } from "../components/IdeaGlowIcon";
import { formatDateTime } from "@/lib/formatDate";
import {
  PRIORITIES,
  STATUS_META,
  groupByProject,
  priorityOf,
  statusOf,
} from "@/lib/ticketStats";

const STATUS_FILTERS = [
  { value: "TODOS", label: "Todos" },
  { value: "ACTIVOS", label: "Activos" },
  { value: "FINALIZADO", label: "Finalizados" },
  { value: "ELIMINADO", label: "Eliminados" },
];

function matchesStatus(ticket, filter) {
  const status = statusOf(ticket);
  if (filter === "TODOS") return true;
  if (filter === "ACTIVOS") return status === "PENDIENTE" || status === "EN_PROCESO";
  return status === filter;
}

function FilterChip({ active, onClick, children, color = "#00E5FF" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
        active ? "text-white" : "border-[#2A2C38] bg-[#161822] text-slate-400 hover:text-white"
      }`}
      style={active ? { borderColor: color, backgroundColor: `${color}22`, boxShadow: `0 0 14px ${color}33` } : undefined}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
      style={{ borderColor: `${meta.color}88`, backgroundColor: `${meta.color}1A`, color: status === "EN_PROCESO" ? "#F4F4F6" : meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

// === Reportes ===
export default function ReportesPage() {
  const { projects, tickets, loading, error, reload } = useWorkspaceData({ includeDeleted: true });
  const [projectFilter, setProjectFilter] = useState("TODOS");
  const [statusFilter, setStatusFilter] = useState("TODOS");

  const groups = useMemo(() => groupByProject(tickets, projects), [tickets, projects]);

  const visibleGroups = useMemo(
    () =>
      groups
        .filter((group) => projectFilter === "TODOS" || group.key === projectFilter)
        .map((group) => ({
          ...group,
          tickets: group.tickets
            .filter((ticket) => matchesStatus(ticket, statusFilter))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
        }))
        .filter((group) => group.tickets.length > 0),
    [groups, projectFilter, statusFilter],
  );

  const deletedCount = tickets.filter((t) => statusOf(t) === "ELIMINADO").length;

  return (
    <SectionShell
      icon={FileSpreadsheet}
      accent="#FF007F"
      title="Reportes"
      subtitle={`Historial completo: ${tickets.length} correcciones, ${deletedCount} eliminadas por el cliente.`}
    >
      <StateMessage
        loading={loading}
        error={error}
        onRetry={reload}
        empty={tickets.length === 0 ? "Todavía no hay correcciones registradas." : null}
      >
        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={projectFilter === "TODOS"} onClick={() => setProjectFilter("TODOS")}>
              Todos los proyectos
            </FilterChip>
            {groups.map((group) => (
              <FilterChip key={group.key} active={projectFilter === group.key} onClick={() => setProjectFilter(group.key)}>
                {group.name}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => (
              <FilterChip
                key={option.value}
                active={statusFilter === option.value}
                onClick={() => setStatusFilter(option.value)}
                color={option.value === "ELIMINADO" ? "#FF003C" : option.value === "FINALIZADO" ? "#00FF66" : "#00E5FF"}
              >
                {option.label}
              </FilterChip>
            ))}
          </div>
        </div>

        {visibleGroups.length === 0 ? (
          <p className="rounded-2xl border border-[#2A2C38] bg-[#12131A] p-8 text-center text-sm text-slate-400">
            No hay correcciones con estos filtros.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleGroups.map((group) => (
              <Panel key={group.key}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-black text-white">
                    {group.name}
                    {group.client && <span className="ml-2 text-xs font-normal text-slate-500">{group.client}</span>}
                  </h2>
                  <span className="text-[11px] text-slate-500">{group.tickets.length} correcciones</span>
                </div>
                <ul className="divide-y divide-[#252734]">
                  {group.tickets.map((ticket) => {
                    const status = statusOf(ticket);
                    const priority = PRIORITIES.find((p) => p.value === priorityOf(ticket));
                    const deleted = status === "ELIMINADO";
                    return (
                      <li key={String(ticket._id ?? ticket.id)} className={`flex flex-wrap items-center gap-3 py-3 ${deleted ? "opacity-80" : ""}`}>
                        <span className="flex shrink-0 items-center justify-center rounded-md border border-[#FFD600]/25 bg-[#FFD600]/10 p-1">
                          <IdeaGlowIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs italic leading-snug text-[#F4F4F6] ${deleted ? "line-through decoration-[#FF003C]/60" : ""}`}>
                            {quoteComment(ticket.title)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {formatDateTime(ticket.createdAt) || "Sin fecha"}
                            {ticket.author ? ` · ${ticket.author}` : ""}
                            {deleted && ticket.deletedAt ? ` · eliminado ${formatDateTime(ticket.deletedAt)}` : ""}
                          </p>
                        </div>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: priority.color }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: priority.color, boxShadow: `0 0 6px ${priority.color}` }} />
                          {priority.value}
                        </span>
                        <StatusBadge status={status} />
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            ))}
          </div>
        )}
      </StateMessage>
    </SectionShell>
  );
}
