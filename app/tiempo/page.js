"use client";

import { useMemo } from "react";
import { History } from "lucide-react";
import SectionShell, {
  Panel,
  ProgressBar,
  StatCard,
  StateMessage,
} from "../components/sections/SectionShell";
import useWorkspaceData from "../components/sections/useWorkspaceData";
import { quoteComment } from "../components/IdeaGlowIcon";
import {
  formatDuration,
  groupByProject,
  resolutionMs,
} from "@/lib/ticketStats";

// === Tiempo ===
export default function TiempoPage() {
  const { projects, tickets, loading, error, reload } = useWorkspaceData();

  const stats = useMemo(() => {
    const resolved = tickets
      .map((ticket) => ({ ticket, ms: resolutionMs(ticket) }))
      .filter((item) => item.ms != null);

    const total = resolved.reduce((sum, item) => sum + item.ms, 0);
    const fastest = resolved.reduce((best, item) => (!best || item.ms < best.ms ? item : best), null);

    const byProject = groupByProject(tickets, projects)
      .map((group) => {
        const times = group.tickets.map(resolutionMs).filter((ms) => ms != null);
        const sum = times.reduce((acc, ms) => acc + ms, 0);
        return {
          ...group,
          resolved: times.length,
          total: sum,
          average: times.length ? sum / times.length : null,
          fastest: times.length ? Math.min(...times) : null,
          slowest: times.length ? Math.max(...times) : null,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      resolved: resolved.length,
      total,
      average: resolved.length ? total / resolved.length : null,
      fastest,
      byProject,
      maxTotal: Math.max(1, ...byProject.map((p) => p.total)),
    };
  }, [tickets, projects]);

  return (
    <SectionShell
      icon={History}
      accent="#7000FF"
      title="Tiempo"
      subtitle="Desde que el cliente reporta hasta que aprueba la corrección."
    >
      <StateMessage
        loading={loading}
        error={error}
        onRetry={reload}
        empty={stats.resolved === 0 ? "Todavía no hay tickets finalizados para medir tiempos." : null}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Promedio de resolución" value={formatDuration(stats.average)} hint={`${stats.resolved} tickets finalizados`} color="#00E5FF" />
          <StatCard label="Tiempo total invertido" value={formatDuration(stats.total)} hint="Suma de todos los proyectos" color="#F4F4F6" />
          <StatCard label="Ticket más rápido" value={formatDuration(stats.fastest?.ms)} hint={stats.fastest ? quoteComment(stats.fastest.ticket.title) : ""} color="#00FF66" />
          <StatCard label="Clientes con entregas" value={stats.byProject.filter((p) => p.resolved).length} hint={`de ${stats.byProject.length} proyectos con tickets`} color="#FF007F" />
        </div>

        <Panel title="Desglose por cliente / proyecto" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
                <tr className="border-b border-[#252734]">
                  <th className="py-2 pr-3 font-bold">Proyecto</th>
                  <th className="py-2 pr-3 font-bold">Finalizados</th>
                  <th className="py-2 pr-3 font-bold">Promedio</th>
                  <th className="py-2 pr-3 font-bold">Más rápido</th>
                  <th className="py-2 pr-3 font-bold">Más lento</th>
                  <th className="w-1/4 py-2 font-bold">Tiempo total</th>
                </tr>
              </thead>
              <tbody>
                {stats.byProject.map((project) => (
                  <tr key={project.key} className="border-b border-[#252734] last:border-0">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-[#F4F4F6]">{project.name}</p>
                      {project.client && <p className="text-[11px] text-slate-500">{project.client}</p>}
                    </td>
                    <td className="py-3 pr-3 text-slate-300">{project.resolved}/{project.tickets.length}</td>
                    <td className="py-3 pr-3 font-bold text-[#00E5FF]">{formatDuration(project.average)}</td>
                    <td className="py-3 pr-3 text-[#00FF66]">{formatDuration(project.fastest)}</td>
                    <td className="py-3 pr-3 text-[#FF007F]">{formatDuration(project.slowest)}</td>
                    <td className="py-3">
                      <p className="mb-1.5 font-bold text-[#F4F4F6]">{formatDuration(project.resolved ? project.total : null)}</p>
                      <ProgressBar value={(project.total / stats.maxTotal) * 100} color="#7000FF" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </StateMessage>
    </SectionShell>
  );
}
