"use client";

import { useMemo } from "react";
import { BarChart2 } from "lucide-react";
import SectionShell, {
  Panel,
  ProgressBar,
  StatCard,
  StateMessage,
} from "../components/sections/SectionShell";
import useWorkspaceData from "../components/sections/useWorkspaceData";
import {
  PRIORITIES,
  groupByProject,
  percent,
  priorityOf,
  statusOf,
} from "@/lib/ticketStats";

// === Rendimiento ===
export default function RendimientoPage() {
  const { projects, tickets, loading, error, reload } = useWorkspaceData();

  const stats = useMemo(() => {
    const finished = tickets.filter((t) => statusOf(t) === "FINALIZADO");
    const inProgress = tickets.filter((t) => statusOf(t) === "EN_PROCESO");
    const pending = tickets.filter((t) => statusOf(t) === "PENDIENTE");

    const byPriority = PRIORITIES.map((priority) => {
      const list = tickets.filter((t) => priorityOf(t) === priority.value);
      const done = list.filter((t) => statusOf(t) === "FINALIZADO").length;
      return { ...priority, total: list.length, done };
    });

    const byProject = groupByProject(tickets, projects).map((group) => ({
      ...group,
      total: group.tickets.length,
      done: group.tickets.filter((t) => statusOf(t) === "FINALIZADO").length,
    }));

    return {
      total: tickets.length,
      finished: finished.length,
      inProgress: inProgress.length,
      pending: pending.length,
      effectiveness: percent(finished.length, tickets.length),
      byPriority,
      byProject,
      maxProject: Math.max(1, ...byProject.map((p) => p.total)),
    };
  }, [tickets, projects]);

  return (
    <SectionShell
      icon={BarChart2}
      accent="#00E5FF"
      title="Rendimiento"
      subtitle="Tu trabajo en todos tus proyectos y clientes."
    >
      <StateMessage
        loading={loading}
        error={error}
        onRetry={reload}
        empty={tickets.length === 0 ? "Todavía no recibiste tickets en tus proyectos." : null}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tickets recibidos" value={stats.total} hint={`${projects.length} proyectos`} color="#F4F4F6" />
          <StatCard label="Finalizados" value={stats.finished} hint="Aprobados por el cliente" color="#00FF66" />
          <StatCard label="Efectividad" value={`${stats.effectiveness}%`} hint="Finalizados sobre recibidos" color="#00E5FF" />
          <StatCard label="En curso" value={stats.pending + stats.inProgress} hint={`${stats.pending} pendientes · ${stats.inProgress} en proceso`} color="#FF007F" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="Por prioridad">
            <div className="space-y-4">
              {stats.byPriority.map((priority) => (
                <div key={priority.value}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-bold" style={{ color: priority.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priority.color, boxShadow: `0 0 8px ${priority.color}` }} />
                      {priority.value}
                    </span>
                    <span className="text-slate-400">
                      {priority.done}/{priority.total} resueltos · {percent(priority.done, priority.total)}%
                    </span>
                  </div>
                  <ProgressBar value={percent(priority.done, priority.total)} color={priority.color} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Actividad por cliente / proyecto">
            <div className="space-y-4">
              {stats.byProject.map((project) => (
                <div key={project.key}>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#F4F4F6]">
                      {project.name}
                      {project.client && <span className="ml-2 font-normal text-slate-500">{project.client}</span>}
                    </span>
                    <span className="text-slate-400">
                      {project.done}/{project.total} · {percent(project.done, project.total)}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#161822]">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-[#7000FF]/45" style={{ width: `${percent(project.total, stats.maxProject)}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.5)]" style={{ width: `${percent(project.done, stats.maxProject)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 flex items-center gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#7000FF]" />Recibidos</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#00E5FF]" />Finalizados</span>
            </p>
          </Panel>
        </div>
      </StateMessage>
    </SectionShell>
  );
}
