"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, LogOut, Plus, Search } from "lucide-react";
import Sidebar from "./components/Sidebar";
import TicketCard from "./components/TicketCard";
import TicketModal from "./components/TicketModal";
import LoginModal from "./components/LoginModal";

const PRIORITY_OPTIONS = ["TODAS", "Alta", "Media", "Baja"];

const PRIORITY_DOT = {
  Alta: "bg-[#ff0055]",
  Media: "bg-[#ffaa00]",
  Baja: "bg-[#00ff66]",
};

const EMPTY_PROJECT_FORM = { name: "", clientName: "", targetUrl: "" };

// Bucket virtual para tickets que no pertenecen a ningún proyecto (legacy sin
// projectId, o creados por la extensión con un nombre que ya no existe).
const UNASSIGNED_PROJECT = {
  id: "__unassigned__",
  name: "Sin proyecto",
  clientName: "",
  targetUrl: "",
  status: "active",
  isUnassigned: true,
};

function normalizeProject(project) {
  return {
    id: String(project.id ?? project._id),
    name: typeof project.name === "string" ? project.name : "",
    clientName: typeof project.clientName === "string" ? project.clientName : "",
    targetUrl: typeof project.targetUrl === "string" ? project.targetUrl : "",
    status: project.status || "active",
  };
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Un ticket pertenece al proyecto por id. Los tickets históricos (sin
// projectId) se siguen asignando por nombre, sin importar espacios ni mayúsculas.
function ticketBelongsToProject(ticket, project) {
  if (!project) return false;

  if (ticket.projectId != null && String(ticket.projectId) !== "") {
    return String(ticket.projectId) === String(project.id);
  }

  return normalizeName(ticket.project) === normalizeName(project.name);
}

export default function Dashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ticketsError, setTicketsError] = useState("");
  const [ticketsReload, setTicketsReload] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("TODAS");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [projectsReload, setProjectsReload] = useState(0);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_PROJECT_FORM);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [userRole, setUserRole] = useState(null);
  const [mounted, setMounted] = useState(false);

  // La sesión vive en localStorage: se lee recién después del montaje para que
  // el primer render del cliente coincida con el HTML del servidor.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
      setUserRole(localStorage.getItem("fixea_session_role") || null);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!userRole) {
      return;
    }

    let isMounted = true;

    const loadTickets = async () => {
      setLoading(true);
      setTicketsError("");

      try {
        const res = await fetch("/api/tickets", { cache: "no-store" });

        if (!res.ok) {
          throw new Error(`La API respondió con estado ${res.status}`);
        }

        const data = await res.json();

        if (isMounted && data.success && Array.isArray(data.tickets)) {
          setTickets(
            data.tickets.map((ticket) => ({
              ...ticket,
              id: ticket.id ?? ticket._id?.toString?.() ?? ticket._id,
            })),
          );
        }
      } catch (error) {
        if (isMounted) {
          console.error("Error al obtener tickets de la base de datos:", error);
          setTicketsError(
            "No se pudieron cargar los tickets. Revisá la conexión con la base de datos.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTickets();

    return () => {
      isMounted = false;
    };
  }, [userRole, ticketsReload]);

  useEffect(() => {
    if (!userRole) {
      return;
    }

    let isMounted = true;

    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectsError("");

      try {
        const res = await fetch("/api/projects", { cache: "no-store" });

        if (!res.ok) {
          throw new Error(`La API respondió con estado ${res.status}`);
        }

        const data = await res.json();

        if (!isMounted || !data?.success || !Array.isArray(data.projects)) {
          return;
        }

        const normalized = data.projects
          .map(normalizeProject)
          .filter((project) => project.id && project.name);

        setProjects(normalized);

        const storedId = localStorage.getItem("fixea_project_id");
        const selected = normalized.some((project) => project.id === storedId)
          ? storedId
          : normalized[0]?.id ?? null;

        setActiveProjectId(selected);
      } catch (error) {
        if (isMounted) {
          console.error("Error al obtener los proyectos:", error);
          setProjectsError(
            "No se pudieron cargar los proyectos. Revisá la conexión con la base de datos.",
          );
        }
      } finally {
        if (isMounted) {
          setProjectsLoading(false);
        }
      }
    };

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, [userRole, projectsReload]);

  // Persiste la selección recién después del montaje para no tocar storage
  // durante el render.
  useEffect(() => {
    if (!mounted || !activeProjectId) return;

    const project = projects.find((item) => item.id === activeProjectId);
    if (!project) return;

    localStorage.setItem("fixea_project_id", project.id);
    localStorage.setItem("fixea_project", project.name);
  }, [mounted, activeProjectId, projects]);

  // Tickets que no caen en ningún proyecto real: se agrupan en un bucket
  // "Sin proyecto" para que nunca desaparezcan del tablero.
  const unassignedTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          !projects.some((project) => ticketBelongsToProject(ticket, project)),
      ),
    [tickets, projects],
  );

  const projectOptions = useMemo(
    () =>
      unassignedTickets.length > 0
        ? [...projects, UNASSIGNED_PROJECT]
        : projects,
    [projects, unassignedTickets.length],
  );

  const resolvedProject = useMemo(
    () =>
      projectOptions.find((project) => project.id === activeProjectId) ??
      projectOptions[0] ??
      null,
    [projectOptions, activeProjectId],
  );

  const projectCounts = useMemo(() => {
    const counts = projects.reduce((accumulator, project) => {
      accumulator[project.id] = tickets.filter((ticket) =>
        ticketBelongsToProject(ticket, project),
      ).length;
      return accumulator;
    }, {});

    if (unassignedTickets.length > 0) {
      counts[UNASSIGNED_PROJECT.id] = unassignedTickets.length;
    }

    return counts;
  }, [projects, tickets, unassignedTickets.length]);

  const sidebarProjects = useMemo(() => {
    const list = projects.map((project) => ({
      id: project.id,
      name: project.name,
      count: projectCounts[project.id] || 0,
    }));

    if (unassignedTickets.length > 0) {
      list.push({
        id: UNASSIGNED_PROJECT.id,
        name: UNASSIGNED_PROJECT.name,
        count: unassignedTickets.length,
      });
    }

    return list;
  }, [projects, projectCounts, unassignedTickets.length]);

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  };

  const handleUpdateEstado = async (ticketId, newStatus) => {
    if (!ticketId || !newStatus) {
      return;
    }

    const previousStatus = tickets.find((ticket) => ticket.id === ticketId)?.status;

    // Actualización optimista: la UI cambia antes de confirmar con la API.
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket,
      ),
    );
    setSelectedTicket((prev) =>
      prev && prev.id === ticketId ? { ...prev, status: newStatus } : prev,
    );

    try {
      const res = await fetch(
        `/api/tickets/${encodeURIComponent(ticketId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "No se pudo actualizar el ticket");
      }
    } catch (error) {
      console.error("Error al actualizar el estado del ticket:", error);

      // Rollback si la API rechaza el cambio.
      if (previousStatus) {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticketId
              ? { ...ticket, status: previousStatus }
              : ticket,
          ),
        );
        setSelectedTicket((prev) =>
          prev && prev.id === ticketId
            ? { ...prev, status: previousStatus }
            : prev,
        );
      }
    }
  };

  const handleTicketUpdated = (ticketId, updatedTicket) => {
    if (!ticketId || !updatedTicket) return;

    setTickets((prev) =>
      prev.map((ticket) =>
        String(ticket.id) === String(ticketId)
          ? { ...ticket, ...updatedTicket, id: ticket.id }
          : ticket,
      ),
    );
    setSelectedTicket((prev) =>
      prev && String(prev.id) === String(ticketId)
        ? { ...prev, ...updatedTicket, id: prev.id }
        : prev,
    );
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleTickets = useMemo(() => {
    const matchesResolvedProject = (ticket) =>
      resolvedProject?.isUnassigned
        ? !projects.some((project) => ticketBelongsToProject(ticket, project))
        : ticketBelongsToProject(ticket, resolvedProject);

    return tickets.filter((ticket) => {
      if (!matchesResolvedProject(ticket)) {
        return false;
      }

      if (priorityFilter !== "TODAS" && ticket.priority !== priorityFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [ticket.title, ticket.author, ticket.priority, ticket.type, ticket.number]
        .filter((value) => value !== undefined && value !== null)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        );
    });
  }, [tickets, projects, resolvedProject, priorityFilter, normalizedSearch]);

  const pendiente = visibleTickets.filter((t) => t.status === "PENDIENTE");
  const enProceso = visibleTickets.filter((t) => t.status === "EN_PROCESO");
  const finalizado = visibleTickets.filter((t) => t.status === "FINALIZADO");

  const columns = [
    {
      key: "PENDIENTE",
      title: "PENDIENTE",
      tickets: pendiente,
      cardClassName: "",
      emptyMessage: resolvedProject
        ? `No hay tickets pendientes en ${resolvedProject.name}.`
        : "No hay tickets pendientes.",
    },
    {
      key: "EN_PROCESO",
      title: "EN PROCESO",
      tickets: enProceso,
      cardClassName: "opacity-90",
      emptyMessage: "No hay tareas en proceso.",
    },
    {
      key: "FINALIZADO",
      title: "FINALIZADO",
      tickets: finalizado,
      cardClassName:
        "opacity-45 saturate-50 hover:opacity-90 hover:saturate-100 transition-all",
      emptyMessage: "No hay tickets finalizados.",
    },
  ];

  const openCreateProject = () => {
    setCreateForm(EMPTY_PROJECT_FORM);
    setCreateError("");
    setCreateOpen(true);
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();

    if (creating) return;

    const name = createForm.name.trim();

    if (!name) {
      setCreateError("El nombre del proyecto es obligatorio");
      return;
    }

    setCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clientName: createForm.clientName,
          targetUrl: createForm.targetUrl,
          status: "active",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo crear el proyecto");
      }

      const project = normalizeProject(data.project);

      setProjects((prev) => [project, ...prev]);
      setActiveProjectId(project.id);
      setProjectsError("");
      // Si la carga inicial falló, este refetch trae el resto de los proyectos.
      setProjectsReload((value) => value + 1);
      setCreateOpen(false);
      setCreateForm(EMPTY_PROJECT_FORM);
      setCreateError("");
    } catch (error) {
      setCreateError(error.message || "No se pudo crear el proyecto");
    } finally {
      setCreating(false);
    }
  };

  const handleSelectedRole = (role) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fixea_session_role", role);
    }
    setUserRole(role);

    if (role === "client") {
      router.push("/cliente");
    }
  };

  const handleLogOut = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("fixea_session_role");
    }
    setUserRole(null);
  };

  if (!mounted) {
    return <div className="min-h-screen w-full bg-black" aria-hidden="true" />;
  }

  if (!userRole) {
    return <LoginModal selectRole={handleSelectedRole} />;
  }

  return (
    <div className="relative flex min-h-screen bg-[#0B0C10] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        activeProject={resolvedProject?.id ?? null}
        setActiveProject={setActiveProjectId}
        projects={sidebarProjects}
        onCreateProject={openCreateProject}
      />

      <main
        className={`flex-1 transition-all duration-300 px-5 py-6 sm:px-8 ${sidebarOpen ? "ml-64" : "ml-18"}`}
      >
        {/* HEADER: buscador central con borde neón + cambio de sesión */}
        <header className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-[1fr_minmax(280px,400px)_1fr] md:items-center">
          <div className="hidden md:block">
            <div className="flex items-center gap-2">
              <select
                value={resolvedProject?.id ?? ""}
                onChange={(event) =>
                  setActiveProjectId(event.target.value || null)
                }
                aria-label="Proyecto activo"
                className="max-w-[220px] cursor-pointer rounded-xl border border-cyan-400/40 bg-[#0C0E17] px-3 py-2 text-sm font-bold text-cyan-300 transition-colors focus:border-cyan-400 focus:outline-none"
              >
                {projectOptions.length === 0 && (
                  <option value="">Sin proyectos</option>
                )}
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={openCreateProject}
                aria-label="Crear proyecto"
                title="Crear proyecto"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-cyan-400/40 bg-[#0C0E17] text-cyan-300 transition-colors hover:border-cyan-400 hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {(loading || projectsLoading) && (
              <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Sincronizando tickets...
              </span>
            )}
          </div>

          <div className="relative order-first w-full md:order-none">
            <div className="flex items-center gap-1 rounded-full bg-[linear-gradient(90deg,#22d3ee,#6366f1,#ec4899)] p-[1.5px] shadow-[0_0_18px_rgba(34,211,238,0.35)]">
              <label className="flex h-10 flex-1 items-center gap-2 rounded-full bg-[#F1F5F9] px-4">
                <Search className="h-4 w-4 shrink-0 text-[#0F121D]" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={
                    resolvedProject
                      ? `Buscar en ${resolvedProject.name}`
                      : "Buscar tickets"
                  }
                  aria-label="Buscar tickets"
                  className="w-full bg-transparent text-xs font-semibold text-[#0F121D] placeholder:font-medium placeholder:text-slate-500 focus:outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-label="Filtros de prioridad"
                aria-expanded={filtersOpen}
                className={`mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9] text-[#0F121D] transition-colors hover:bg-white ${
                  priorityFilter !== "TODAS" ? "ring-2 ring-[#0F121D]/40" : ""
                }`}
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>

            {filtersOpen && (
              <div className="absolute left-1/2 top-12 z-30 w-44 -translate-x-1/2 rounded-xl border border-cyan-400/40 bg-[#0C0E17] p-2 shadow-[0_0_25px_rgba(0,229,255,0.15)]">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Prioridad
                </p>
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setPriorityFilter(option);
                      setFiltersOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                      priorityFilter === option
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    <span>{option === "TODAS" ? "Todas" : option}</span>
                    {option !== "TODAS" && (
                      <span
                        className={`h-2 w-2 rounded-full ${PRIORITY_DOT[option]}`}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-start md:justify-end">
            <button
              type="button"
              onClick={handleLogOut}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-400/60 bg-[#141824] px-4 py-2 text-xs font-bold text-cyan-300 shadow-lg transition-all hover:border-red-400 hover:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cambiar sesión</span>
            </button>
          </div>
        </header>

        {/* TABLERO KANBAN: secciones horizontales con tarjetas en fila */}
        {projectsLoading ? (
          <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-[#2A2B33] text-xs text-slate-500">
            Sincronizando proyectos...
          </div>
        ) : projectsError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-red-500/40 bg-[#0C0E17]/60 p-10 text-center">
            <p className="text-base font-black text-white">
              No pudimos cargar los proyectos
            </p>
            <p className="max-w-sm text-xs text-slate-400">{projectsError}</p>
            <button
              type="button"
              onClick={() => setProjectsReload((value) => value + 1)}
              className="mt-1 cursor-pointer rounded-xl border border-cyan-400/60 bg-[#141824] px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:border-cyan-400 hover:text-white"
            >
              Reintentar
            </button>
          </div>
        ) : ticketsError ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-red-500/40 bg-[#0C0E17]/60 p-10 text-center">
            <p className="text-base font-black text-white">
              No pudimos cargar los tickets
            </p>
            <p className="max-w-sm text-xs text-slate-400">{ticketsError}</p>
            <button
              type="button"
              onClick={() => setTicketsReload((value) => value + 1)}
              className="mt-1 cursor-pointer rounded-xl border border-cyan-400/60 bg-[#141824] px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:border-cyan-400 hover:text-white"
            >
              Reintentar
            </button>
          </div>
        ) : projects.length === 0 && unassignedTickets.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#2A2B33] bg-[#0C0E17]/60 p-10 text-center">
            <p className="text-base font-black text-white">
              Todavía no hay proyectos
            </p>
            <p className="max-w-sm text-xs text-slate-400">
              Creá el primero para empezar a organizar los tickets por cliente y
              sitio.
            </p>
            <button
              type="button"
              onClick={openCreateProject}
              className="mt-1 cursor-pointer rounded-xl border border-cyan-400/60 bg-[#141824] px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:border-cyan-400 hover:text-white"
            >
              Crear proyecto
            </button>
          </div>
        ) : (
          <div className="space-y-9">
            {columns.map((column) => (
              <section key={column.key} aria-labelledby={`section-${column.key}`}>
                <div className="rounded-2xl bg-[linear-gradient(90deg,#22d3ee,#6366f1,#ec4899)] p-[1.5px] shadow-[0_0_20px_rgba(34,211,238,0.18),0_0_26px_rgba(236,72,153,0.12)]">
                  <div className="flex h-14 items-center rounded-[14px] bg-[#0B0C10] px-5">
                    <h2
                      id={`section-${column.key}`}
                      className="text-base font-black uppercase tracking-[0.08em] text-white sm:text-lg"
                    >
                      {column.title}
                    </h2>
                  </div>
                </div>

                <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                  {column.tickets.length === 0 ? (
                    <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-[#2A2B33] text-xs text-slate-500">
                      {loading ? "Sincronizando tickets..." : column.emptyMessage}
                    </div>
                  ) : (
                    column.tickets.map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onClick={() => openTicket(ticket)}
                        className={`w-[190px] shrink-0 sm:w-[200px] ${column.cardClassName}`}
                      />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <form
              onSubmit={handleCreateProject}
              className="w-full max-w-md rounded-2xl border border-cyan-400/40 bg-[#0C0E17] p-6 shadow-[0_0_40px_rgba(0,229,255,0.18)]"
            >
              <h2 className="text-base font-black text-white">Nuevo proyecto</h2>
              <p className="mt-1 text-xs text-slate-400">
                Definí el cliente y el sitio que vas a revisar.
              </p>

              <label className="mt-5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Nombre *
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#141824] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Cliente
                <input
                  type="text"
                  maxLength={120}
                  value={createForm.clientName}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      clientName: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#141824] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>

              <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                URL objetivo
                <input
                  type="url"
                  placeholder="https://"
                  value={createForm.targetUrl}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      targetUrl: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#141824] px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                />
              </label>

              {createError && (
                <p className="mt-3 text-xs font-semibold text-red-400">
                  {createError}
                </p>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                  className="cursor-pointer rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="cursor-pointer rounded-xl border border-cyan-400/60 bg-[#141824] px-4 py-2 text-xs font-bold text-cyan-300 transition-colors hover:border-cyan-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? "Creando..." : "Crear"}
                </button>
              </div>
            </form>
          </div>
        )}

        <TicketModal
          isOpen={isModalOpen}
          ticket={selectedTicket}
          updateEstado={handleUpdateEstado}
          onTicketUpdated={handleTicketUpdated}
          onClose={() => setIsModalOpen(false)}
        />
      </main>
    </div>
  );
}
