"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, LogOut, Search } from "lucide-react";
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

export default function Dashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeProject, setActiveProject] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("TODAS");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [userRole, setUserRole] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fixea_session_role") || null;
    }
    return null;
  });

  useEffect(() => {
    if (!userRole) {
      return;
    }

    let isMounted = true;

    const loadTickets = async () => {
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
  }, [userRole]);

  const projects = useMemo(
    () =>
      [...new Set(tickets.map((ticket) => ticket.project).filter(Boolean))].sort(),
    [tickets],
  );

  // Keep the selection stable while filters/search change. If the stored
  // selection disappears, fall back to the first available project.
  const resolvedActiveProject =
    activeProject && projects.includes(activeProject)
      ? activeProject
      : projects[0] || null;

  const projectCounts = useMemo(() => {
    return tickets.reduce((accumulator, ticket) => {
      if (ticket.project) {
        accumulator[ticket.project] = (accumulator[ticket.project] || 0) + 1;
      }
      return accumulator;
    }, {});
  }, [tickets]);

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
    return tickets.filter((ticket) => {
      if (!resolvedActiveProject || ticket.project !== resolvedActiveProject) {
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
  }, [tickets, resolvedActiveProject, priorityFilter, normalizedSearch]);

  const pendiente = visibleTickets.filter((t) => t.status === "PENDIENTE");
  const enProceso = visibleTickets.filter((t) => t.status === "EN_PROCESO");
  const finalizado = visibleTickets.filter((t) => t.status === "FINALIZADO");

  const columns = [
    {
      key: "PENDIENTE",
      title: "PENDIENTE",
      tickets: pendiente,
      cardClassName: "",
      emptyMessage: resolvedActiveProject
        ? `No hay tickets pendientes en ${resolvedActiveProject}.`
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

  if (!userRole) {
    return <LoginModal selectRole={handleSelectedRole} />;
  }

  return (
    <div className="relative flex min-h-screen bg-[#0B0C10] text-white">
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        activeProject={resolvedActiveProject}
        setActiveProject={setActiveProject}
        projectCounts={projectCounts}
        projects={projects}
      />

      <main
        className={`flex-1 transition-all duration-300 px-5 py-6 sm:px-8 ${sidebarOpen ? "ml-64" : "ml-18"}`}
      >
        {/* HEADER: buscador central con borde neón + cambio de sesión */}
        <header className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-[1fr_minmax(280px,400px)_1fr] md:items-center">
          <div className="hidden md:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Proyecto activo
            </p>
            <p className="text-sm font-black text-cyan-300">
              {resolvedActiveProject || "Sin proyectos"}
            </p>
            {loading && (
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
                    resolvedActiveProject
                      ? `Buscar en ${resolvedActiveProject}`
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
