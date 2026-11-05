"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import useIsMounted from "../lib/useIsMounted";
import Sidebar from "./components/Sidebar";
import TicketCard from "./components/TicketCard";
import TicketModal from "./components/TicketModal";
import ProjectKeyBadge from "./components/ProjectKeyBadge";
import FixeaLoader from "./components/FixeaLoader";
import Image from "next/image";

function validateTargetUrl(url) {
  if (!url || typeof url !== "string") {
    return { error: "La URL es obligatoria", value: "" };
  }
  let cleanUrl = url.trim();
  if (!cleanUrl) {
    return { error: "La URL es obligatoria", value: "" };
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = cleanUrl.includes("localhost")
      ? `http://${cleanUrl}`
      : `https://${cleanUrl}`;
  }
  return { error: null, value: cleanUrl };
}

const REQUEST_TIMEOUT_MS = 10000;

// fetch con timeout: si la API de sesión no responde, la UI muestra un error
// con reintento en lugar de quedar colgada esperando para siempre.
async function fetchJsonWithTimeout(
  url,
  options = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const data = await res.json().catch(() => null);
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

const PRIORITY_FILTERS = [
  { value: "TODAS", label: "Todas", dot: null },
  { value: "Alta", label: "Alta", dot: "bg-[#FF003C]" },
  { value: "Media", label: "Media", dot: "bg-[#FFEA00]" },
  { value: "Baja", label: "Baja", dot: "bg-[#00FF66]" },
];

function CoffeeIcon() {
  return (
    <div className="mx-auto flex justify-center">
      <Image
        src="/taza.png"
        alt="Sin tickets"
        width={80}
        height={80}
        priority
        className="h-auto w-auto object-contain drop-shadow-[0_0_12px_rgba(0,229,255,0.4)]"
      />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center select-none font-sans">
      <CoffeeIcon />
      <p className="mt-4 text-sm font-semibold text-[#F1F5F9]/90 tracking-wide">
        {message || "¡Todo al día! No tenés tickets pendientes."}
      </p>
    </div>
  );
}

const EMPTY_PROJECT_FORM = { name: "", clientName: "", targetUrl: "" };

const EXTENSION_ENVIRONMENT_KEYS = [
  "fixea_projects",
  "fixea_project_id",
  "fixea_project",
  "fixea_project_target_url",
];

/**
 * Puente Dashboard -> extensión. Se ejecuta también al crear el primer
 * proyecto para que Chrome detecte el sitio sin esperar al siguiente render.
 * Cuando la lista queda vacía se borran las claves: la extensión no debe
 * conservar un proyecto fantasma ni mostrar herramientas de anotación.
 */
function persistProjectEnvironment(projectList, activeProject) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      "fixea_dashboard_origin",
      window.location.origin,
    );

    const list = Array.isArray(projectList) ? projectList : [];

    if (list.length === 0) {
      EXTENSION_ENVIRONMENT_KEYS.forEach((key) =>
        window.localStorage.removeItem(key),
      );
    } else {
      window.localStorage.setItem(
        "fixea_projects",
        JSON.stringify(
          list.map((project) => ({
            id: project.id,
            name: project.name,
            targetUrl: project.targetUrl || "",
          })),
        ),
      );

      if (activeProject && !activeProject.isUnassigned) {
        window.localStorage.setItem("fixea_project_id", activeProject.id);
        window.localStorage.setItem("fixea_project", activeProject.name);
        window.localStorage.setItem(
          "fixea_project_target_url",
          activeProject.targetUrl || "",
        );
      } else {
        [
          "fixea_project_id",
          "fixea_project",
          "fixea_project_target_url",
        ].forEach((key) => window.localStorage.removeItem(key));
      }
    }

    // Avisa a la extensión (content.js) sin esperar al polling.
    window.dispatchEvent(new CustomEvent("fixea:environment-synced"));
  } catch (error) {
    console.warn("No se pudo sincronizar el entorno con la extensión:", error);
  }
}

// Espera a que content.js lea localStorage y actualice chrome.storage.
// Si la extensión no está instalada, el timeout deja seguir el flujo.
function syncExtensionEnvironment(projectList, activeProject) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("fixea:environment-sync-done", finish);
      resolve();
    };

    const timer = setTimeout(finish, 1500);
    window.addEventListener("fixea:environment-sync-done", () => {
      clearTimeout(timer);
      finish();
    });

    persistProjectEnvironment(projectList, activeProject);
  });
}

function WelcomeState({ error, onCreate, onRetry }) {
  return (
    <section className="mx-auto mt-4 w-full max-w-2xl">
      <div className="rounded-3xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] p-[1.5px] shadow-[0_0_60px_rgba(112,0,255,0.28)]">
        <div className="rounded-[22px] bg-[#0F1015] px-6 py-10 text-center sm:px-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00E5FF]/40 bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_24px_rgba(0,229,255,0.25)]">
            <Plus className="h-7 w-7" />
          </span>

          {error ? (
            <>
              <h2 className="mt-5 text-2xl font-black text-white">
                No pudimos cargar tus proyectos
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                Revisá la conexión con el servidor e intentá de nuevo.
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-6 cursor-pointer rounded-xl border border-[#00E5FF]/60 bg-[#1F2029] px-5 py-2.5 text-sm font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
              >
                Reintentar
              </button>
            </>
          ) : (
            <>
              <h2 className="mt-5 text-2xl font-black text-white">
                ¡Bienvenido a FIXEA!
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                Creá tu primer proyecto indicando el nombre de tu cliente y el
                enlace de Vercel o localhost para comenzar.
              </p>
              <button
                type="button"
                onClick={onCreate}
                className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] px-5 py-3 text-sm font-black text-[#0B0C10] shadow-[0_0_30px_rgba(0,229,255,0.3)] transition-transform hover:scale-[1.02]"
              >
                <Plus className="h-4 w-4" />
                Crear mi primer proyecto
              </button>
              <div className="mx-auto mt-7 grid max-w-lg gap-2 text-left text-[11px] text-slate-500 sm:grid-cols-3">
                <span className="rounded-lg border border-slate-800 px-3 py-2">
                  1. Creá el proyecto con su URL
                </span>
                <span className="rounded-lg border border-slate-800 px-3 py-2">
                  2. Instalá la extensión de Chrome
                </span>
                <span className="rounded-lg border border-slate-800 px-3 py-2">
                  3. Reportá sobre el sitio real
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const UNASSIGNED_PROJECT = {
  id: "__unassigned__",
  name: "Sin proyecto",
  clientName: "",
  targetUrl: "",
  status: "active",
  isUnassigned: true,
};

function normalizeProject(project) {
  const targetUrl =
    project?.targetUrl || project?.url || project?.siteUrl || "";
  return {
    id: String(project.id ?? project._id),
    name: typeof project.name === "string" ? project.name : "",
    clientName:
      typeof project.clientName === "string" ? project.clientName : "",
    targetUrl: typeof targetUrl === "string" ? targetUrl.trim() : "",
    status: project.status || "active",
    accessKey: typeof project.accessKey === "string" ? project.accessKey : "",
  };
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const VALID_TICKET_STATUSES = ["PENDIENTE", "EN_PROCESO", "FINALIZADO"];

function normalizeTicketStatus(value) {
  const normalized =
    typeof value === "string"
      ? value.trim().toUpperCase().replace(/\s+/g, "_")
      : "";

  return VALID_TICKET_STATUSES.includes(normalized) ? normalized : "PENDIENTE";
}

function getTicketIdentityKeys(ticket) {
  return [
    ticket?._id != null ? String(ticket._id) : "",
    ticket?.id != null ? String(ticket.id) : "",
  ].filter(Boolean);
}

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
  const [priorityFilter, setPriorityFilter] = useState("TODAS");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [projectsReload, setProjectsReload] = useState(0);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_PROJECT_FORM);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState("");
  const [sessionReload, setSessionReload] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const mounted = useIsMounted();

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      setSessionError("");

      try {
        const { res, data } = await fetchJsonWithTimeout("/api/auth/me", {
          cache: "no-store",
        });

        if (!active) return;

        if (res.status === 401) {
          router.replace("/inicio");
          return;
        }

        if (!res.ok || !data?.success || !data?.user) {
          throw new Error(data?.error || `API respondió ${res.status}`);
        }

        setSession(data.user);
      } catch (error) {
        if (!active) return;

        console.error("Error al cargar la sesión:", error);
        setSessionError(
          error?.name === "AbortError"
            ? "La verificación de la sesión tardó demasiado."
            : "No se pudo verificar la sesión.",
        );
      }
    };

    loadSession();
    return () => {
      active = false;
    };
  }, [router, sessionReload]);

  useEffect(() => {
    if (!profileOpen) return;
    const handlePointerDown = (event) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!createOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !creating) setCreateOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [createOpen, creating]);

useEffect(() => {
  if (!session) return;
  let isMounted = true;
  const loadProjects = async () => {
    setProjectsLoading(true);
    setProjectsError("");
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (!res.ok) throw new Error(`Estado ${res.status}`);
      const data = await res.json();
      if (!isMounted || !data?.success || !Array.isArray(data.projects)) return;
      const normalized = data.projects.map(normalizeProject).filter((p) => p.id && p.name);
      setProjects(normalized);
      
      const storedId = localStorage.getItem("fixea_project_id");
      // Solo activa un proyecto si estaba guardado explícitamente en localStorage. 
      // De lo contrario, queda en null sin seleccionar ninguno por defecto.
      setActiveProjectId(normalized.some((p) => p.id === storedId) ? storedId : null);
    } catch (error) {
      if (isMounted) setProjectsError("No se pudieron cargar los proyectos.");
    } finally {
      if (isMounted) setProjectsLoading(false);
    }
  };
  loadProjects();
  return () => { isMounted = false; };
}, [session, projectsReload]);

  // Carga de tickets desde Mongo. Este efecto se había perdido en el refactor
  // de la preentrega: el tablero arrancaba con [] y nunca pedía los tickets,
  // así que los reportes del cliente "desaparecían" aunque estuvieran en la DB.
  useEffect(() => {
    if (!session) return;

    let isMounted = true;
    let inFlight = false;
    let firstLoad = true;

    const loadTickets = async () => {
      if (inFlight) return;
      inFlight = true;
      if (firstLoad) setLoading(true);

      try {
        const { res, data } = await fetchJsonWithTimeout("/api/tickets", {
          cache: "no-store",
        });

        if (!res.ok || !data?.success || !Array.isArray(data.tickets)) {
          throw new Error(data?.error || `La API respondió ${res.status}`);
        }

        if (!isMounted) return;

        setTicketsError("");
        setTickets(
          data.tickets.map((ticket) => ({
            ...ticket,
            id: ticket.id ?? ticket._id?.toString?.() ?? ticket._id,
          })),
        );
      } catch (error) {
        if (!isMounted) return;
        console.error("Error al obtener tickets de la base de datos:", error);
        setTicketsError(
          error?.name === "AbortError"
            ? "La carga de tickets tardó demasiado."
            : "No se pudieron cargar los tickets.",
        );
      } finally {
        inFlight = false;
        firstLoad = false;
        if (isMounted) setLoading(false);
      }
    };

    loadTickets();

    // Refresco en vivo:
    // - la extensión avisa al crear/editar/borrar (fixea:tickets-changed y
    //   fixea_tickets_rev desde otra pestaña);
    // - al volver a la pestaña;
    // - sondeo liviano, porque cliente y programador suelen estar en
    //   navegadores distintos y ahí el aviso de la extensión no llega.
    const onChanged = () => loadTickets();
    const onStorage = (event) => {
      if (event.key === "fixea_tickets_rev") loadTickets();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") loadTickets();
    };

    window.addEventListener("fixea:tickets-changed", onChanged);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onChanged);
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") loadTickets();
    }, 10000);

    return () => {
      isMounted = false;
      window.removeEventListener("fixea:tickets-changed", onChanged);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onChanged);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [session, ticketsReload]);

  const unassignedTickets = useMemo(() => {
    return tickets.filter(
      (t) => !projects.some((p) => ticketBelongsToProject(t, p)),
    );
  }, [tickets, projects]);

  const projectOptions = useMemo(() => {
    return unassignedTickets.length > 0
      ? [...projects, UNASSIGNED_PROJECT]
      : projects;
  }, [projects, unassignedTickets.length]);

  const resolvedProject = useMemo(() => {
    return (
      projectOptions.find((p) => p.id === activeProjectId) ??
      projectOptions[0] ??
      null
    );
  }, [projectOptions, activeProjectId]);

  useEffect(() => {
    if (projectsLoading || projectsError) return;
    persistProjectEnvironment(projects, resolvedProject);
  }, [projects, resolvedProject, projectsLoading, projectsError]);

  const projectCounts = useMemo(() => {
    const counts = projects.reduce((acc, p) => {
      acc[p.id] = tickets.filter((t) => ticketBelongsToProject(t, p)).length;
      return acc;
    }, {});
    if (unassignedTickets.length > 0)
      counts[UNASSIGNED_PROJECT.id] = unassignedTickets.length;
    return counts;
  }, [projects, tickets, unassignedTickets.length]);

  const sidebarProjects = useMemo(() => {
    const list = projects.map((p) => ({
      id: p.id,
      name: p.name,
      count: projectCounts[p.id] || 0,
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
    if (!ticketId || !newStatus) return;

    const previousStatus = tickets.find(
      (ticket) => ticket.id === ticketId,
    )?.status;

    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket,
      ),
    );
    setSelectedTicket((prev) =>
      prev && prev.id === ticketId ? { ...prev, status: newStatus } : prev,
    );

    try {
      const { res, data } = await fetchJsonWithTimeout(
        `/api/tickets/${encodeURIComponent(ticketId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo actualizar el ticket");
      }

      if (data.ticket) {
        handleTicketUpdated(ticketId, data.ticket);
      }
    } catch (error) {
      console.error("Error al actualizar el estado del ticket:", error);

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

    const targetUrlResult = validateTargetUrl(createForm.targetUrl);

    if (targetUrlResult.error) {
      setCreateError(targetUrlResult.error);
      return;
    }

    const targetUrl = targetUrlResult.value;

    setCreating(true);
    setCreateError("");

    try {
      const { res, data } = await fetchJsonWithTimeout("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clientName: createForm.clientName,
          targetUrl,
          status: "active",
        }),
      });

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo crear el proyecto");
      }

      const project = normalizeProject(data.project);
      const nextProjects = [project, ...projects];

      await syncExtensionEnvironment(nextProjects, project);

      setProjects(nextProjects);
      setActiveProjectId(project.id);
      setProjectsError("");
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

  const handleLogOut = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      const { res } = await fetchJsonWithTimeout(
        "/api/auth/logout",
        { method: "POST" },
        8000,
      );

      if (!res.ok) {
        throw new Error(`La API respondió ${res.status}`);
      }

      await syncExtensionEnvironment([], null);

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      setLogoutError("No se pudo cerrar sesión. Intentá de nuevo.");
    } finally {
      setLoggingOut(false);
    }
  };

  const visibleTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (ticket.deleted) return false;
      const matchesProject = resolvedProject?.isUnassigned
        ? !projects.some((p) => ticketBelongsToProject(ticket, p))
        : ticketBelongsToProject(ticket, resolvedProject);
      if (!matchesProject) return false;
      if (priorityFilter !== "TODAS" && ticket.priority !== priorityFilter)
        return false;
      return true;
    });
  }, [tickets, projects, resolvedProject, priorityFilter]);

  const columns = useMemo(() => {
    const grouped = { PENDIENTE: [], EN_PROCESO: [], FINALIZADO: [] };
    const seen = new Set();

    for (const ticket of visibleTickets) {
      const identityKeys = getTicketIdentityKeys(ticket);
      if (identityKeys.some((key) => seen.has(key))) continue;
      identityKeys.forEach((key) => seen.add(key));

      grouped[normalizeTicketStatus(ticket.status)].push(ticket);
    }

    return [
      {
        key: "PENDIENTE",
        title: "PENDIENTE",
        tickets: grouped.PENDIENTE,
        emptyMessage: "¡Todo al día! No tenés bugs pendientes.",
        sectionClass: "opacity-100",
        headerClass: "opacity-100 text-white",
        cardClass:
          "opacity-100 border-[#00E5FF]/60 shadow-[0_0_18px_rgba(0,229,255,0.22)] hover:shadow-[0_0_26px_rgba(0,229,255,0.35)] transition-all duration-200",
        headerGlow:
          "shadow-[0_0_26px_rgba(0,229,255,0.24),0_0_46px_rgba(255,0,127,0.12)]",
      },
      {
        key: "EN_PROCESO",
        title: "EN PROCESO",
        tickets: grouped.EN_PROCESO,
        emptyMessage: "No hay tareas en proceso.",
        sectionClass:
          "opacity-75 transition-opacity duration-200 hover:opacity-100",
        headerClass: "opacity-75 text-white/80",
        cardClass:
          "border-[#FFEA00]/40 transition-opacity duration-200 hover:opacity-100",
        headerGlow: "shadow-[0_0_20px_rgba(0,229,255,0.18)]",
      },
      {
        key: "FINALIZADO",
        title: "FINALIZADO",
        tickets: grouped.FINALIZADO,
        emptyMessage: "No hay tickets finalizados.",
        sectionClass:
          "opacity-45 saturate-50 transition-all duration-200 hover:opacity-100 hover:saturate-100",
        headerClass: "opacity-45 text-white/50 saturate-50",
        cardClass:
          "border-[#00FF66]/20 transition-all duration-200 hover:opacity-100 hover:saturate-100",
        headerGlow: "shadow-[0_0_20px_rgba(0,229,255,0.12)]",
      },
    ];
  }, [visibleTickets]);

  if (!mounted) return <FixeaLoader fullScreen label="Cargando" />;

  if (!session) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[var(--Negro-fondo-1,#0B0C10)] px-4 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-[#00E5FF]/30 bg-[#1F2029] p-6 text-center shadow-[0_0_30px_rgba(0,229,255,0.12)]">
          {sessionError ? (
            <>
              <p className="text-sm font-bold text-[#FF003C]">
                No pudimos verificar tu sesión
              </p>
              <p className="mt-1 text-xs text-slate-400">{sessionError}</p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSessionReload((value) => value + 1)}
                  className="cursor-pointer rounded-xl border border-[#00E5FF]/60 bg-[#1F2029] px-4 py-2 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={() => router.replace("/inicio")}
                  className="cursor-pointer rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                >
                  Ir al inicio
                </button>
              </div>
            </>
          ) : (
            <FixeaLoader size={36} label="Verificando sesión…" className="justify-center" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-[var(--Negro-fondo-1,#0B0C10)] text-white font-sans">
      <Sidebar
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
        activeProject={resolvedProject?.id ?? null}
        setActiveProject={setActiveProjectId}
        projects={sidebarProjects}
        onCreateProject={openCreateProject}
        user={session}
        onLogOut={handleLogOut}
        loggingOut={loggingOut}
        logoutError={logoutError}
      />

      <main
        className={`min-w-0 flex-1 overflow-x-hidden px-5 pb-6 transition-all duration-300 sm:px-8 ${sidebarOpen ? "ml-64 pt-6" : "ml-0 pt-16"}`}
      >
        {/* HEADER */}
        <header className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {projectOptions.length > 0 ? (
              <select
                value={resolvedProject?.id ?? ""}
                onChange={(e) => setActiveProjectId(e.target.value || null)}
                className="max-w-[220px] cursor-pointer rounded-xl border border-[#00E5FF]/40 bg-[#1F2029] px-3 py-2 text-sm font-bold text-[#00E5FF] focus:outline-none"
              >
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="rounded-xl border border-slate-800 bg-[#1F2029] px-3 py-2 text-sm font-bold text-slate-500">
                Sin proyectos
              </span>
            )}
            <button
              type="button"
              onClick={openCreateProject}
              aria-label="Crear proyecto"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#00E5FF]/40 bg-[#1F2029] text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
            {!resolvedProject?.isUnassigned && (
              // key: al cambiar de proyecto se remonta y la Key vuelve a ocultarse.
              <ProjectKeyBadge
                key={resolvedProject?.id}
                projectKey={resolvedProject?.accessKey}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PRIORITY_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriorityFilter(option.value)}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                  priorityFilter === option.value
                    ? "border-[#00E5FF] bg-[#00E5FF]/15 text-white shadow-[0_0_14px_rgba(0,229,255,0.25)]"
                    : "border-slate-700 bg-[#1F2029] text-slate-400 hover:border-slate-500 hover:text-white"
                }`}
              >
                {option.dot && (
                  <span className={`h-2 w-2 rounded-full ${option.dot}`} />
                )}
                {option.label}
              </button>
            ))}
          </div>
        </header>

        {/* TABLERO KANBAN */}
        {projectsLoading && projects.length === 0 ? (
          <div className="mx-auto mt-10 flex max-w-2xl justify-center rounded-2xl border border-slate-800 bg-[#1F2029] px-6 py-10">
            <FixeaLoader size={32} label="Cargando proyectos…" />
          </div>
        ) : projects.length === 0 ? (
          <WelcomeState
            error={projectsError}
            onCreate={openCreateProject}
            onRetry={() => setProjectsReload((value) => value + 1)}
          />
        ) : (
          <div className="space-y-9">
            {ticketsError && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FF007F]/50 bg-[#FF007F]/10 px-4 py-3 text-sm font-semibold text-[#FF8FC7]"
              >
                <span>{ticketsError}</span>
                <button
                  type="button"
                  onClick={() => setTicketsReload((value) => value + 1)}
                  className="cursor-pointer rounded-lg border border-[#FF007F]/60 px-3 py-1 text-xs font-bold text-white hover:border-[#FF007F]"
                >
                  Reintentar
                </button>
              </div>
            )}
            {loading && tickets.length === 0 && !ticketsError && (
              <div className="flex justify-center py-2">
                <FixeaLoader size={22} label="Cargando tickets…" />
              </div>
            )}
            {columns.map((column) => (
              <section key={column.key} className={column.sectionClass}>
                <div
                  className={`rounded-2xl bg-[linear-gradient(90deg,#00E5FF,#7000FF,#FF007F)] p-[1.5px] ${column.headerGlow}`}
                >
                  <div className="flex h-14 items-center rounded-[14px] bg-[#0B0C10] px-5">
                    <h2
                      className={`text-base font-black uppercase tracking-[0.08em] sm:text-lg ${column.headerClass}`}
                    >
                      {column.title}
                    </h2>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                  {column.tickets.length === 0 ? (
                    <EmptyState message={column.emptyMessage} />
                  ) : (
                    column.tickets.map((ticket, index) => (
                      <TicketCard
                        key={ticket.id || index}
                        ticket={ticket}
                        className={column.cardClass}
                        onClick={() => openTicket(ticket)}
                      />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {createOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo proyecto"
            onClick={() => {
              if (!creating) setCreateOpen(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0C10]/80 p-4 backdrop-blur-sm"
          >
            <form
              onSubmit={handleCreateProject}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-[#00E5FF]/40 bg-[#1F2029] p-6 shadow-[0_0_40px_rgba(0,229,255,0.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-white">
                    Nuevo proyecto
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Definí el cliente y el sitio que vas a revisar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                  aria-label="Cerrar"
                  className="cursor-pointer text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

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
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1F2029] px-3 py-2 text-sm text-white focus:border-[#00E5FF] focus:outline-none"
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
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1F2029] px-3 py-2 text-sm text-white focus:border-[#00E5FF] focus:outline-none"
                />
              </label>

              <label className="mt-4 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                URL objetivo *
                <input
                  type="text"
                  inputMode="url"
                  required
                  placeholder="https://mi-app.vercel.app o http://localhost:3000"
                  value={createForm.targetUrl}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      targetUrl: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1F2029] px-3 py-2 text-sm text-white focus:border-[#00E5FF] focus:outline-none"
                />
                <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-slate-500">
                  Acepta dominios Vercel (*.vercel.app) y localhost. Si omitís
                  el protocolo, se agrega automáticamente.
                </span>
              </label>

              {createError && (
                <p className="mt-3 text-xs font-semibold text-[#FF003C]">
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
                  className="cursor-pointer rounded-xl border border-[#00E5FF]/60 bg-[#1F2029] px-4 py-2 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <span className="inline-flex items-center gap-2">
                      <FixeaLoader size={14} />
                      Creando…
                    </span>
                  ) : (
                    "Crear"
                  )}
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
