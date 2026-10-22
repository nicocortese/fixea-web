"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import ClientValidation from "../components/ClientValidation";
import ClientToolbar from "../components/ClientToolbar";
import { COLORS, cursorForTool } from "@/lib/toolTheme";

export default function ClientePage() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const [activeTool, setActiveTool] = useState(null);
  const [activeColor, setActiveColor] = useState(COLORS[0].value);
  const [showValidation, setShowValidation] = useState(false);

  // El proyecto se resuelve después del montaje: primero el query param y
  // después la selección guardada. Si no hay uno válido, la página bloquea la
  // creación de pines hasta que el cliente elija un proyecto.
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [session, setSession] = useState(null);

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

        // Arranque limpio: sin `?ticket=` no se selecciona nada automáticamente.
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

  // Resuelve el proyecto activo contra la API. El id tiene que existir: nunca
  // se cae a `localhost` ni a un nombre cacheado sin id.
  useEffect(() => {
    let active = true;

    const resolveProject = async () => {
      setProjectsLoading(true);
      setProjectsError(false);

      let list;
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || !Array.isArray(data.projects)) {
          throw new Error(data?.error || `API respondió ${res.status}`);
        }

        list = data.projects;
      } catch (error) {
        console.error("Error al cargar los proyectos:", error);
        if (!active) return;
        setProjects([]);
        setProjectsError(true);
        setProjectId(null);
        setProjectName("");
        setProjectsLoading(false);
        return;
      }

      if (!active) return;

      setProjects(list);

      const params = new URLSearchParams(window.location.search);
      const queryId = params.get("projectId");
      const storedId = window.localStorage.getItem("fixea_project_id");
      const requested = queryId || storedId;
      // Si la URL o el storage no traen un proyecto válido, arrancamos con el
      // primero disponible: el canvas nunca queda bloqueado por falta de id.
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
        window.localStorage.setItem("fixea_project_id", id);
        window.localStorage.setItem("fixea_project", project.name ?? "");

        if (queryId !== id) {
          // Deja el projectId explícito en la URL para que el link sea
          // compartible tal cual.
          params.set("projectId", id);
          router.replace(`/cliente?${params.toString()}`, { scroll: false });
        }
      } else {
        // Un id huérfano no se persiste: se pide elegir de nuevo.
        if (requested) window.localStorage.removeItem("fixea_project_id");
        setProjectId(null);
        setProjectName("");
      }

      setProjectsLoading(false);
    };

    resolveProject();

    return () => {
      active = false;
    };
  }, [router, reloadKey]);

  // `createdBy` sale de la sesión verificada, no de un campo editable.
  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => null);

        if (active && res.ok && data?.success) {
          setSession(data.user ?? null);
        }
      } catch {
        // Sin sesión no se bloquea la vista: proxy.js ya protege /cliente.
      }
    };

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  const selectProject = (project) => {
    const id = String(project.id ?? project._id);

    setProjectId(id);
    setProjectName(project.name ?? "");
    window.localStorage.setItem("fixea_project_id", id);
    window.localStorage.setItem("fixea_project", project.name ?? "");

    const params = new URLSearchParams(window.location.search);
    params.set("projectId", id);
    router.replace(`/cliente?${params.toString()}`, { scroll: false });
  };

  // Al crear un ticket desde la toolbar, refrescamos la lista para que el pin
  // quede asociado a un id real y sea clickeable.
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

  const updateTicketStatus = async (nextStatus) => {
    if (isUpdating) return false;

    const ticketIdentifier = activeTicket?._id
      ? String(activeTicket._id)
      : activeTicket?.id;

    if (ticketIdentifier == null) {
      showNotice(
        "error",
        "No hay ningún ticket en la base de datos para actualizar."
      );
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
        }
      );
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo actualizar el ticket.");
      }

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
          : "Ticket devuelto a pendientes"
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

  // Ids reales de la base: la toolbar solo pinta anotaciones que se pueden abrir.
  const linkedTicketIds = useMemo(
    () =>
      tickets.flatMap((ticket) =>
        [ticket.id, ticket._id].filter((id) => id != null),
      ),
    [tickets],
  );

  const getTicketKey = (ticket) => String(ticket?._id ?? ticket?.id ?? "");

  // Única fuente de pines: los tickets reales del proyecto activo. Nada de
  // anotaciones mock ni de posiciones hardcodeadas.
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

      // 404 = ya no existe: la anotación igual debe desaparecer.
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

    // La goma tiene prioridad sobre la apertura del detalle.
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
      const res = await fetch("/api/auth/logout", { method: "POST" });

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

  // Cualquier clic fuera de la tarjeta de revisión (backdrop, canvas,
  // toolbar) la cierra. El pin queda excluido: su propio handler decide.
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
    <div className="relative w-full min-h-screen bg-[#0B0C10] select-none overflow-x-hidden">
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

      {/* El cliente no tiene dashboard: "Volver a FIXEA" lo devolvería acá
          porque proxy.js redirige a los clientes fuera de "/". */}
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

      {/* Selector de proyecto: discreto, en el header, y nunca bloquea el
          canvas. Al cambiarlo se actualiza ?projectId= y los pines del
          proyecto se recalculan solos. */}
      <div
        data-fixea-ui
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="fixed top-4 left-4 z-50 flex items-center gap-2"
      >
        <select
          value={projectId ?? ""}
          onChange={(event) => {
            const next = projects.find(
              (item) => String(item.id ?? item._id) === event.target.value,
            );
            if (next) selectProject(next);
          }}
          disabled={projects.length === 0}
          aria-label="Proyecto activo"
          title="Proyecto activo"
          className="max-w-[220px] cursor-pointer rounded-full border border-slate-700 bg-[#1F2029]/90 px-3 py-1.5 text-xs font-bold text-slate-200 shadow-[0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-colors hover:border-[#00E5FF] focus:border-[#00E5FF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {projects.length === 0 && (
            <option value="">
              {projectsLoading ? "Cargando proyectos…" : "Sin proyectos"}
            </option>
          )}
          {projects.map((project) => {
            const id = String(project.id ?? project._id);

            return (
              <option key={id} value={id}>
                {project.name}
              </option>
            );
          })}
        </select>

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

      {/* Contenedor interactivo de la captura. El padding superior reserva
          espacio para que los botones fijos no tapen el header del sitio
          embebido; la toolbar vive fuera y mantiene su propio cursor. */}
      <div className="pt-16">
        <div
          ref={canvasRef}
          data-fixea-canvas
          style={{ cursor: cursorForTool(activeTool, activeColor) }}
          className="relative w-full"
        >
        <Image
          src="/captura.png"
          alt="Web del cliente"
          width={1920}
          height={1080}
          priority
          className="w-full h-auto block select-none pointer-events-none"
        />
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

      {/* Pines de los tickets reales del proyecto activo. Viven fuera del
          contenedor con padding para usar las mismas coordenadas de página que
          las anotaciones de la toolbar. */}
      {projectTickets.map((ticket) => {
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
          <div
            key={ticketKey}
            data-fixea-ui
            data-fixea-ticket-pin
            style={{
              left: `${ticket.coords.x}px`,
              top: `${ticket.coords.y}px`,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (activeTool === "erase") e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();

              // Con la goma activa el pin no abre la revisión: se borra el
              // ticket (DELETE) y el clic no sigue hacia la página.
              if (activeTool === "erase") {
                e.preventDefault();
                handleEraseTicket(ticket);
                return;
              }

              setActiveTicket(ticket);
              setShowValidation(true);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
          >
            <button
              type="button"
              aria-label={ticket.title || "Reporte"}
              title={ticket.title || "Reporte"}
              className="relative flex cursor-pointer items-center justify-center group"
            >
              <span
                className={`w-12 h-12 rounded-full border-2 animate-ping absolute -inset-0 m-auto ${ringClass}`}
              />
              <span
                className={`w-8 h-8 rounded-full bg-[#0B0C10] border-2 relative z-10 transition-transform group-hover:scale-110 ${dotClass}`}
              />
            </button>

            {isActive && showValidation && (
              <ClientValidation
                ticket={ticket}
                onApprove={handleApprove}
                onReject={handleReject}
                onClose={() => setShowValidation(false)}
                isUpdating={isUpdating}
              />
            )}
          </div>
        );
      })}

      {/* Barra de herramientas */}
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
      />
    </div>
  );
}
