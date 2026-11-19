// === Métricas de tickets ===

export const PRIORITIES = [
  { value: "Alta", color: "#FF003C" },
  { value: "Media", color: "#FF007F" },
  { value: "Baja", color: "#00FF66" },
];

export const STATUS_META = {
  PENDIENTE: { label: "Pendiente", color: "#00E5FF" },
  EN_PROCESO: { label: "En proceso", color: "#7000FF" },
  FINALIZADO: { label: "Finalizado", color: "#00FF66" },
  ELIMINADO: { label: "Eliminado", color: "#FF003C" },
};

export function isDeletedTicket(ticket) {
  return Boolean(ticket?.isDeleted || ticket?.deleted);
}

export function statusOf(ticket) {
  if (isDeletedTicket(ticket)) return "ELIMINADO";
  const raw = String(ticket?.status || "").toUpperCase();
  return STATUS_META[raw] ? raw : "PENDIENTE";
}

export function priorityOf(ticket) {
  const value = String(ticket?.priority || "");
  return PRIORITIES.some((p) => p.value === value) ? value : "Baja";
}

function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function resolutionMs(ticket) {
  if (statusOf(ticket) !== "FINALIZADO") return null;
  const start = toTime(ticket.createdAt);
  const end = toTime(ticket.verifiedAt) ?? toTime(ticket.updatedAt);
  if (start == null || end == null || end < start) return null;
  return end - start;
}

export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes ? `${hours} h ${restMinutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function counterpartEmail(project) {
  if (!project) return "";
  const collaborators = Array.isArray(project.collaboratorEmails)
    ? project.collaboratorEmails.filter(Boolean)
    : [];
  return project.membership === "owner"
    ? collaborators[0] || ""
    : project.ownerEmail || "";
}

export function groupByProject(tickets, projects) {
  const byId = new Map(projects.map((project) => [String(project.id), project]));
  const groups = new Map();

  for (const ticket of tickets) {
    const id = ticket.projectId != null ? String(ticket.projectId) : "";
    const project = byId.get(id);
    const key = project ? id : `sin-proyecto:${ticket.project || ""}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: project?.name || ticket.project || "Sin proyecto",
        client: project ? counterpartEmail(project) || project.clientName || "" : "",
        tickets: [],
      });
    }
    groups.get(key).tickets.push(ticket);
  }

  return [...groups.values()].sort((a, b) => b.tickets.length - a.tickets.length);
}
