"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import ClientValidation from "../components/ClientValidation";
import ClientToolbar from "../components/ClientToolbar";
import FixeaLoader from "../components/FixeaLoader";
import JoinProjectForm from "../components/JoinProjectForm";
import ProjectKeyBadge from "../components/ProjectKeyBadge";
import { KeyRound, Plus } from "lucide-react";
import { COLORS, cursorForTool } from "@/lib/toolTheme";

export default function ClientePage() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const [activeTool, setActiveTool] = useState(null);
  const [activeColor, setActiveColor] = useState(COLORS[0].value);
  const [showValidation, setShowValidation] = useState(false);
  const [toolbarExpanded, setToolbarExpanded] = useState(false);

  // Estados del proyecto
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [projectTargetUrl, setProjectTargetUrl] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [projectMembership, setProjectMembership] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [session, setSession] = useState(null);

  // Estado para abrir el modal de creación de proyecto si no tiene ninguno
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Pestaña del modal de proyecto: crear uno propio o unirse con una Key.
  const [projectModalTab, setProjectModalTab] = useState("create");
  // Proyecto a activar en la próxima carga (recién creado o vinculado). Tiene
  // prioridad sobre ?projectId= porque router.replace actualiza la URL de
  // forma asíncrona y la recarga leía todavía el proyecto anterior.
  const preferredProjectIdRef = useRef(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    let active = true;

    const loadActiveTicket = async () => {
      try {
        const res = await fetch("/api/tickets", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || !Array.isArray(data.tickets)) {
          throw new Error(data?.error || `API respondió ${res.status}`);
        }

        if (!active) return;

        setTickets(data.tickets);

        const requestedId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("ticket")
            : null;

        const target = requestedId
          ? data.tickets.find(
              (ticket) =>
                String(ticket.id) === requestedId ||
                String(ticket._id) === requestedId,
            )
          : null;

        setActiveTicket(target || null);
      } catch (error) {
        console.error("Error al cargar el ticket activo:", error);
        if (active) setActiveTicket(null);
      } finally {
        if (active) setLoadingTicket(false);
      }
    };

    loadActiveTicket();

    return () => {
      active = false;
    };
  }, []);

  // Resuelve el proyecto activo contra la API
  useEffect(() => {
    let active = true;

    const resolveProject = async () => {
      setProjectsLoading(true);
      setProjectsError(false);

      let list;
      try {
        const res = await fetch("/api/projects?scope=client", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || !Array.isArray(data.projects)) {
          throw new Error(data?.error || `API respondió ${res.status}`);
        }

        list = data.projects;
      } catch (error) {
        console.error("Error al cargar los proyectos:", error);
        if (!active) return;
        setProjectsError(true);
        setProjectId(null);
        setProjectName("");
        setProjectTargetUrl("");
        setProjectKey("");
        setProjectMembership("");
        setProjectsLoading(false);
        return;
      }

      if (!active) return;

      try {
        window.localStorage.setItem(
          "fixea_dashboard_origin",
          window.location.origin,
        );

        if (list.length === 0) {
          [
            "fixea_projects",
            "fixea_project_id",
            "fixea_project",
            "fixea_project_target_url",
          ].forEach((key) => window.localStorage.removeItem(key));

          // Si no tiene proyectos, abrimos el modal automáticamente para que cree uno
          setShowCreateModal(true);
        } else {
          window.localStorage.setItem(
            "fixea_projects",
            JSON.stringify(
              list.map((item) => ({
                id: String(item.id ?? item._id),
                name: item.name ?? "",
                targetUrl: item.targetUrl ?? "",
                accessKey: item.accessKey ?? "",
              })),
            ),
          );
        }
      } catch (error) {
        console.warn("No se pudo sincronizar la lista de proyectos:", error);
      }

      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("projectId");
      const storedId = window.localStorage.getItem("fixea_project_id");
      const preferred = preferredProjectIdRef.current;
      preferredProjectIdRef.current = null;
      const requested = preferred || queryId || storedId;

      const project =
        (requested
          ? list.find(
              (item) => String(item.id ?? item._id) === String(requested),
            )
          : null) ??
        list[0] ??
        null;

      if (project) {
        const id = String(project.id ?? project._id);
        setProjectId(id);
        setProjectName(project.name ?? "");
        setProjectTargetUrl(project.targetUrl ?? "");
        setProjectKey(project.accessKey ?? "");
        setProjectMembership(project.membership ?? "");
        window.localStorage.setItem("fixea_project_id", id);
        window.localStorage.setItem("fixea_project", project.name ?? "");
        window.localStorage.setItem(
          "fixea_project_target_url",
          project.targetUrl ?? "",
        );

        if (queryId !== id) {
          params.set("projectId", id);
          router.replace(`/cliente?${params.toString()}`, { scroll: false });
        }
      } else {
        [
          "fixea_project_id",
          "fixea_project",
          "fixea_project_target_url",
        ].forEach((key) => window.localStorage.removeItem(key));
        setProjectId(null);
        setProjectName("");
        setProjectTargetUrl("");
        setProjectKey("");
        setProjectMembership("");
      }

      try {
        window.dispatchEvent(new CustomEvent("fixea:environment-synced"));
      } catch (error) {
        console.warn("No se pudo avisar a la extensión:", error);
      }

      setProjectsLoading(false);
    };

    resolveProject();

    return () => {
      active = false;
    };
  }, [router, reloadKey]);

  // Carga de sesión
  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json().catch(() => null);

        if (active && res.ok && data?.success) {
          setSession(data.user ?? null);
        }
      } catch {
        // Sin sesión no se bloquea la vista
      }
    };

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  // Refrescar tickets
  useEffect(() => {
    const refreshTickets = async () => {
      try {
        const res = await fetch("/api/tickets", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (res.ok && data?.success && Array.isArray(data.tickets)) {
          setTickets(data.tickets);
        }
      } catch (error) {
        console.error("No se pudieron refrescar los tickets:", error);
      }
    };

    window.addEventListener("fixea:tickets-updated", refreshTickets);

    return () => {
      window.removeEventListener("fixea:tickets-updated", refreshTickets);
    };
  }, []);

  const showNotice = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 3500);
  };

  // Manejador para crear un proyecto nuevo desde el panel del cliente
  const openProjectModal = (tab = "create") => {
    setProjectModalTab(tab);
    setShowCreateModal(true);
  };

  // Deja activo un proyecto recién creado o vinculado. El ?projectId= de la
  // URL tiene prioridad al resolver el proyecto, así que también se actualiza
  // (antes quedaba el anterior activo).
  const activateProject = (id) => {
    if (!id) return;
    preferredProjectIdRef.current = id;
    try {
      window.localStorage.setItem("fixea_project_id", id);
    } catch {
      // Sin localStorage alcanza con la URL.
    }
    const params = new URLSearchParams(window.location.search);
    params.set("projectId", id);
    router.replace(`/cliente?${params.toString()}`, { scroll: false });
  };

  // Se unió con la Key de su programador: queda activo ese proyecto.
  const handleProjectJoined = (project, { alreadyMember } = {}) => {
    activateProject(String(project?.id ?? ""));
    setShowCreateModal(false);
    showNotice(
      "success",
      alreadyMember
        ? `Ya formabas parte de "${project.name}"`
        : `Te uniste a "${project.name}"`,
    );
    setReloadKey((prev) => prev + 1);
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (isCreating) return;

    let finalUrl = newTargetUrl.trim();
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = finalUrl.includes("localhost")
        ? `http://${finalUrl}`
        : `https://${finalUrl}`;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName,
          targetUrl: finalUrl,
          status: "active",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.project) {
        throw new Error(data?.error || "No se pudo crear el proyecto.");
      }

      activateProject(String(data.project.id ?? data.project._id ?? ""));
      showNotice("success", "Proyecto creado correctamente");
      setShowCreateModal(false);
      setNewProjectName("");
      setNewTargetUrl("");
      setReloadKey((prev) => prev + 1); // Recarga los proyectos
    } catch (error) {
      console.error("Error al crear proyecto:", error);
      showNotice("error", error.message || "Error al crear el proyecto.");
    } finally {
      setIsCreating(false);
    }
  };

  const updateTicketStatus = async (nextStatus) => {
    if (isUpdating) return false;

    const ticketIdentifier = activeTicket?._id
      ? String(activeTicket._id)
      : activeTicket?.id;

    if (ticketIdentifier == null) {
      showNotice(
        "error",
        "No hay ningún ticket en la base de datos para actualizar.",
      );
      return false;
    }

    const currentStatus = activeTicket?.status || "PENDIENTE";

    if (nextStatus === "FINALIZADO" && currentStatus !== "EN_PROCESO") {
      showNotice(
        "error",
        "Solo podés verificar una corrección que esté en proceso.",
      );
      return false;
    }

    if (nextStatus === "PENDIENTE" && currentStatus !== "EN_PROCESO") {
      showNotice("error", "Este ticket no tiene una corrección para rechazar.");
      return false;
    }

    setIsUpdating(true);

    try {
      const res = await fetch(
        `/api/tickets/${encodeURIComponent(ticketIdentifier)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo actualizar el ticket.");
      }

      setTickets((prev) =>
        prev.map((item) => {
          const matches =
            String(item._id ?? item.id) === String(ticketIdentifier) ||
            String(item.id) === String(ticketIdentifier);

          if (!matches) return item;

          if (!data.ticket || typeof data.ticket !== "object") {
            return { ...item, status: nextStatus };
          }

          return {
            ...item,
            ...data.ticket,
            _id: item._id ?? data.ticket._id,
            id: item.id ?? data.ticket.id,
          };
        }),
      );

      setActiveTicket((prev) => {
        if (!prev) return prev;
        if (!data.ticket || typeof data.ticket !== "object") {
          return { ...prev, status: nextStatus };
        }
        return {
          ...prev,
          ...data.ticket,
          _id: prev._id ?? data.ticket._id,
          id: prev.id ?? data.ticket.id,
        };
      });
      setShowValidation(false);
      showNotice(
        "success",
        nextStatus === "FINALIZADO"
          ? "Fix aprobado correctamente"
          : "Ticket devuelto a pendientes",
      );
      return true;
    } catch (error) {
      console.error("Error al actualizar el ticket:", error);
      showNotice("error", error.message || "No se pudo actualizar el ticket.");
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleApprove = () => updateTicketStatus("FINALIZADO");
  const handleReject = () => updateTicketStatus("PENDIENTE");

  const linkedTicketIds = useMemo(
    () =>
      tickets.flatMap((ticket) =>
        [ticket.id, ticket._id].filter((id) => id != null),
      ),
    [tickets],
  );

  const getTicketKey = (ticket) => String(ticket?._id ?? ticket?.id ?? "");

  const projectTickets = useMemo(
    () =>
      projectId
        ? tickets.filter(
            (ticket) =>
              ticket.coords &&
              String(ticket.projectId ?? "") === String(projectId),
          )
        : [],
    [tickets, projectId],
  );

  const handleEraseTicket = async (ticket) => {
    if (!ticket) return;

    const identifier = ticket._id != null ? String(ticket._id) : ticket.id;
    if (identifier == null) return;

    try {
      const res = await fetch(
        `/api/tickets/${encodeURIComponent(identifier)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => null);

      if (!res.ok && res.status !== 404) {
        throw new Error(data?.error || "No se pudo borrar el ticket.");
      }
    } catch (error) {
      console.error("Error al borrar el ticket:", error);
      showNotice("error", error.message || "No se pudo borrar el ticket.");
      return;
    }

    const sameTicket = (item) =>
      String(item._id ?? item.id) === String(identifier) ||
      String(item.id) === String(identifier);

    const remaining = tickets.filter((item) => !sameTicket(item));

    setTickets(remaining);
    setShowValidation(false);

    if (activeTicket && sameTicket(activeTicket)) {
      setActiveTicket(remaining[0] ?? null);
    }

    showNotice("success", "Ticket eliminado");

    try {
      const nextRev =
        (Number(localStorage.getItem("fixea_tickets_rev")) || 0) + 1;
      localStorage.setItem("fixea_tickets_rev", String(nextRev));
    } catch {}
  };

  const handleSelectTicket = (annotation) => {
    const candidates = [annotation.id, annotation._id]
      .filter((id) => id != null)
      .map(String);

    const target = tickets.find(
      (ticket) =>
        candidates.includes(String(ticket.id)) ||
        candidates.includes(String(ticket._id)),
    );

    if (!target) {
      showNotice("error", "Ese reporte ya no existe en la base de datos.");
      return;
    }

    if (activeTool === "erase") {
      handleEraseTicket(target);
      return;
    }

    setActiveTicket(target);
    setShowValidation(true);
  };

  const handleLogOut = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`La API respondió ${res.status}`);
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      setLogoutError("No se pudo cerrar sesión. Intentá de nuevo.");
    } finally {
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!showValidation) return;

    const onPointerDown = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("[data-client-validation]")) return;
      if (event.target.closest("[data-fixea-ticket-pin]")) return;

      setShowValidation(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [showValidation]);

  return (
    <div className="relative w-full min-h-screen bg-[var(--Negro-fondo-1,#0B0C10)] select-none overflow-x-hidden">
      {notice && (
        <div
          data-fixea-ui
          onPointerDown={(e) => e.stopPropagation()}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] font-bold px-5 py-2.5 rounded-full text-xs shadow-[0_0_20px_rgba(0,0,0,0.6)] backdrop-blur-md ${
            notice.type === "error"
              ? "bg-[#0B0C10] border border-[#FF003C] text-[#FF003C]"
              : "bg-[#0B0C10] border border-[#00E5FF] text-[#00E5FF]"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Botón Salir */}
      <button
        data-fixea-ui
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleLogOut}
        disabled={loggingOut}
        className="fixed top-4 right-4 z-50 bg-[#0B0C10]/90 border border-slate-700 text-slate-300 hover:border-[#FF003C] hover:text-[#FF003C] text-xs px-3.5 py-1.5 rounded-full font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all backdrop-blur-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{loggingOut ? "Saliendo..." : "Salir"}</span>
      </button>

      {logoutError && (
        <p
          role="alert"
          data-fixea-ui
          className="fixed top-14 right-4 z-50 text-[10px] font-semibold text-[#FF003C]"
        >
          {logoutError}
        </p>
      )}

      {/* Chip de Proyecto e Indicador para crear nuevo proyecto */}
      <div
        data-fixea-ui
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="fixed top-4 left-4 z-50 flex items-center gap-2"
      >
        <div
          title={projectName || "Proyecto"}
          className="flex max-w-[260px] items-center gap-2 rounded-full border border-slate-700 bg-[#1F2029]/90 px-3.5 py-1.5 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Proyecto
          </span>
          <span className="truncate text-xs font-bold text-[#00E5FF]">
            {projectsLoading ? "Cargando…" : projectName || "Sin proyecto"}
          </span>
        </div>

        <button
          type="button"
          onClick={() => openProjectModal("create")}
          className="bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/50 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-[#00E5FF] hover:text-black transition-colors"
        >
          + Nuevo Proyecto
        </button>

        <button
          type="button"
          onClick={() => openProjectModal("join")}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#FF007F]/50 bg-[#FF007F]/10 px-3 py-1.5 text-xs font-bold text-[#FF007F] transition-colors hover:bg-[#FF007F] hover:text-black"
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          Vincular
        </button>

        {projectMembership === "collaborator" && (
          <span
            title="Te uniste a este proyecto con su Key"
            className="rounded-full border border-[#7000FF]/50 bg-[#7000FF]/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#B98CFF]"
          >
            Colaborador
          </span>
        )}

        {projectKey && (
          <ProjectKeyBadge key={projectId} projectKey={projectKey} />
        )}

        {projectsError && (
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="cursor-pointer rounded-full border border-[#FF003C]/40 px-3 py-1.5 text-[10px] font-bold text-[#FF003C] transition-colors hover:border-[#FF003C]"
          >
            Reintentar
          </button>
        )}
      </div>

      {/* Lienzo de revisión */}
      <div className="pt-16">
        <div
          ref={canvasRef}
          data-fixea-canvas
          style={{ cursor: cursorForTool(activeTool, activeColor) }}
          className="relative w-full"
        >
          <div className="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_20%_10%,#1F2029,#0B0C10_65%)] px-6 py-20 text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(0,229,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.35) 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />

            <div className="relative z-10 max-w-lg">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Sesión de revisión
              </p>
              <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                {projectName || "Registrá tu sitio web"}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {projectName
                  ? "Los reportes de este proyecto aparecen como pines sobre esta superficie. Usá tu URL objetivo para activar la extensión."
                  : "Para comenzar, creá tu proyecto con la URL de tu sitio o unite al que ya creó tu programador pegando su Key."}
              </p>

              {projectTargetUrl ? (
                <a
                  href={projectTargetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex max-w-full items-center gap-2 truncate rounded-full border border-[#00E5FF]/40 bg-[#1F2029] px-4 py-2 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
                >
                  {projectTargetUrl}
                </a>
              ) : (
                <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openProjectModal("create")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] px-6 py-3 text-sm font-black text-[#0B0C10] shadow-[0_0_30px_rgba(0,229,255,0.3)] transition-transform hover:scale-[1.02]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Crear nuevo proyecto
                  </button>
                  <button
                    type="button"
                    onClick={() => openProjectModal("join")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FF007F]/60 bg-[#1F2029] px-6 py-3 text-sm font-bold text-[#FF007F] transition-colors hover:border-[#FF007F] hover:text-white"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Vincular mediante Key
                  </button>
                </div>
              )}
            </div>
          </div>

          {!loadingTicket && projectTickets.length === 0 && (
            <div className="pointer-events-none absolute bottom-4 left-4 z-30">
              <div className="rounded-xl border border-[#00E5FF]/25 bg-[#1F2029]/90 px-3 py-2 shadow-[0_0_18px_rgba(0,229,255,0.12)] backdrop-blur-sm">
                <p className="text-[11px] font-bold text-[#00E5FF]">
                  Sin reportes todavía
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Los reportes de este proyecto aparecerán acá.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pines de observaciones */}
      {toolbarExpanded &&
        Array.isArray(projectTickets) &&
        projectTickets.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-10">
            {projectTickets.map((ticket) => {
              if (!ticket || (!ticket.coords && !ticket.x)) return null;

              const ticketKey = getTicketKey(ticket);
              const ticketStatus = ticket.status || "PENDIENTE";
              const isActive =
                !!activeTicket && getTicketKey(activeTicket) === ticketKey;

              const ringClass =
                ticketStatus === "FINALIZADO"
                  ? "bg-[#00FF66]/30 border-[#00FF66] shadow-[0_0_30px_#00FF66]"
                  : ticketStatus === "EN_PROCESO"
                    ? "bg-[#FFEA00]/40 border-[#FFEA00] shadow-[0_0_30px_#FFEA00]"
                    : "bg-[#00E5FF]/30 border-[#00E5FF] shadow-[0_0_30px_#00E5FF]";

              const dotClass =
                ticketStatus === "FINALIZADO"
                  ? "border-[#00FF66] shadow-[0_0_15px_#00FF66]"
                  : ticketStatus === "EN_PROCESO"
                    ? "border-[#FFEA00] shadow-[0_0_15px_#FFEA00]"
                    : "border-[#00E5FF] shadow-[0_0_15px_#00E5FF]";

              return (
                <button
                  key={ticketKey}
                  onClick={() => handleSelectTicket(ticket)}
                  className={`pointer-events-auto absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${ringClass} ${
                    isActive ? "scale-125" : ""
                  }`}
                  style={{
                    left: `${ticket.coords?.x || ticket.x}%`,
                    top: `${ticket.coords?.y || ticket.y}%`,
                  }}
                >
                  <div
                    className={`h-4 w-4 rounded-full border-2 bg-[#0B0C10] ${dotClass}`}
                  />
                </button>
              );
            })}
          </div>
        )}

      {/* Modal de validación de tickets */}
      {activeTicket && showValidation && (
        <ClientValidation
          ticket={activeTicket}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setShowValidation(false)}
          isUpdating={isUpdating}
        />
      )}

      {/* MODAL PARA CREAR PROYECTO OBLIGATORIO CON URL OBJETIVO */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1F2029] p-8 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-white">
              Configurar Proyecto
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Creá tu propio proyecto o unite al de tu programador con su Key.
            </p>

            <div
              role="tablist"
              aria-label="Cómo empezar"
              className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-slate-700 bg-[#0B0C10] p-1"
            >
              {[
                { id: "create", label: "Crear proyecto", Icon: Plus },
                { id: "join", label: "Vincular con Key", Icon: KeyRound },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={projectModalTab === id}
                  onClick={() => setProjectModalTab(id)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                    projectModalTab === id
                      ? "bg-[#00E5FF]/15 text-[#00E5FF]"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {projectModalTab === "join" ? (
              <div className="flex flex-col gap-5">
                <p className="text-xs leading-relaxed text-slate-400">
                  Pedile a tu programador la Key del proyecto (FX-…) y pegala
                  acá. Vas a ver sus tickets y la extensión quedará vinculada.
                </p>
                <JoinProjectForm onJoined={handleProjectJoined} autoFocus compact />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
            <form
              onSubmit={handleCreateProject}
              className="flex flex-col gap-5"
            >
              <div>
                <label className="text-sm text-gray-300 font-semibold block mb-2">
                  Nombre del proyecto *
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-[#0B0C10] border border-gray-700 rounded-lg p-3 text-white focus:border-[#00E5FF] outline-none text-sm"
                  placeholder="Ej: E-commerce Zapatillas"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 font-semibold block mb-2">
                  URL objetivo (Target URL) *
                </label>
                <input
                  type="text"
                  required
                  value={newTargetUrl}
                  onChange={(e) => setNewTargetUrl(e.target.value)}
                  className="w-full bg-[#0B0C10] border border-gray-700 rounded-lg p-3 text-white focus:border-[#00E5FF] outline-none text-sm"
                  placeholder="Ej: localhost:3001 o https://misitio.com"
                />
                <p className="text-[11px] text-gray-500 mt-2">
                  La extensión buscará esta URL exactamente en tu pestaña
                  activa.
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-[#00E5FF] text-black px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-white transition-colors disabled:opacity-50"
                >
                  {isCreating ? (
                    <span className="inline-flex items-center gap-2">
                      <FixeaLoader size={14} />
                      Guardando…
                    </span>
                  ) : (
                    "Guardar y Activar"
                  )}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Barra de herramientas original */}
      <ClientToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        onColorChange={setActiveColor}
        canvasRef={canvasRef}
        linkedTicketIds={linkedTicketIds}
        onSelectTicket={handleSelectTicket}
        projectId={projectId}
        projectName={projectName}
        createdBy={session?.id ?? null}
        onExpandedChange={setToolbarExpanded}
      />
    </div>
  );
}
