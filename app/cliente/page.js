"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ClientValidation from "../components/ClientValidation";
import ClientToolbar from "../components/ClientToolbar";

// Cursor del canvas por herramienta. El lápiz usa un SVG propio (punto caliente
// en la punta) para que el trazado se distinga de la cruz por defecto.
const PENCIL_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%2300e5ff' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m4 20 4.2-1.1a2 2 0 0 0 1-.55l9.9-9.9a2.1 2.1 0 0 0 0-3l-1.55-1.55a2.1 2.1 0 0 0-3 0l-9.9 9.9a2 2 0 0 0-.55 1L3.9 19.1A.7.7 0 0 0 4 20z'/><path d='m14.5 6.5 3 3'/></svg>") 4 20, crosshair`;

const CANVAS_CURSOR = {
  pin: PENCIL_CURSOR,
  highlight: "cell",
  arrow: "alias",
  blur: "crosshair",
  sticker: "copy",
  erase: "not-allowed",
};

export default function ClientePage() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const [activeTool, setActiveTool] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const [activePin, setActivePin] = useState(null);

  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notice, setNotice] = useState(null);

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
          : data.tickets[0];

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

  const status = activeTicket?.status || "PENDIENTE";

  // Ids reales de la base: la toolbar solo pinta anotaciones que se pueden abrir.
  const linkedTicketIds = useMemo(
    () =>
      tickets.flatMap((ticket) =>
        [ticket.id, ticket._id].filter((id) => id != null),
      ),
    [tickets],
  );

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

    setActiveTicket(target);
    setActivePin(0);
    setShowValidation(true);
  };

  const handleLogOut = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("fixea_session_role");
    }
    router.push("/");
  };

  return (
    <div className="relative w-full min-h-screen bg-black select-none overflow-x-hidden">
      {notice && (
        <div
          data-fixea-ui
          onPointerDown={(e) => e.stopPropagation()}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] font-bold px-5 py-2.5 rounded-full text-xs shadow-[0_0_20px_rgba(0,0,0,0.6)] backdrop-blur-md ${
            notice.type === "error"
              ? "bg-red-950 border border-red-500 text-red-300"
              : "bg-cyan-950 border border-cyan-400 text-cyan-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Botón Volver a la izquierda. Marcado como UI de Fixea para que un
          clic acá no dispare un pin debajo. */}
      <Link
        data-fixea-ui
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed top-4 left-4 z-50 bg-[#090b11]/90 border border-cyan-400 text-cyan-400 text-xs px-3.5 py-1.5 rounded-full font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)] hover:bg-cyan-950 transition-all flex items-center gap-1.5 backdrop-blur-sm cursor-pointer"
        href="/"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a FIXEA
      </Link>

      <button
        data-fixea-ui
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleLogOut}
        className="fixed top-4 right-4 z-50 bg-[#090b11]/90 border border-slate-700 text-slate-300 hover:border-red-400 hover:text-red-400 text-xs px-3.5 py-1.5 rounded-full font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all backdrop-blur-sm cursor-pointer"
      >
        <span>Cambiar sesión</span>
      </button>

      {/* Contenedor interactivo de la captura. El padding superior reserva espacio
          para que los botones fijos no tapen el header del sitio embebido.
          El canvas cambia el cursor según la herramienta activa; la toolbar y sus
          controles viven fuera de este contenedor y mantienen su propio cursor. */}
      <div className="pt-16">
        <div
          ref={canvasRef}
          data-fixea-canvas
          style={{ cursor: CANVAS_CURSOR[activeTool] ?? "crosshair" }}
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
        {activeTicket && (
          <div
            data-fixea-ui
            style={{ left: `580px`, top: `195px` }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setActivePin(0);
              setShowValidation(true);
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30"
          >
            <button
              type="button"
              className="relative flex items-center justify-center cursor-pointer group"
            >
              <div
                className={`w-12 h-12 rounded-full border-2 animate-ping absolute -inset-0 m-auto ${
                  status === "FINALIZADO"
                    ? "bg-emerald-400/30 border-emerald-400 shadow-[0_0_30px_#00ff66]"
                    : status === "EN_PROCESO"
                      ? "bg-amber-400/40 border-amber-400 shadow-[0_0_30px_#ffaa00]"
                      : "bg-cyan-400/30 border-cyan-400 shadow-[0_0_30px_#00e5ff]"
                }`}
              />
              <div
                className={`w-8 h-8 rounded-full bg-[#0b0c10] border-2 flex items-center justify-center text-xs font-black relative z-10 transition-transform group-hover:scale-110 ${
                  status === "FINALIZADO"
                    ? "border-emerald-400 text-emerald-400 shadow-[0_0_15px_#00ff66]"
                    : status === "EN_PROCESO"
                      ? "border-amber-400 text-amber-400 shadow-[0_0_15px_#ffaa00]"
                      : "border-cyan-400 text-cyan-400 shadow-[0_0_15px_#00e5ff]"
                }`}
              >
                {activeTicket.number ?? 1}
              </div>
            </button>

            {showValidation && activePin === 0 && (
              <ClientValidation
                ticket={activeTicket}
                onApprove={handleApprove}
                onReject={handleReject}
                onClose={() => setShowValidation(false)}
                isUpdating={isUpdating}
              />
            )}
          </div>
        )}

        {!loadingTicket && !activeTicket && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="max-w-sm rounded-2xl border border-cyan-500/30 bg-[#0c0e17]/95 px-6 py-5 text-center shadow-[0_0_30px_rgba(0,229,255,0.15)]">
              <p className="text-sm font-bold text-cyan-300">
                No hay tickets para validar todavía
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Los reportes creados desde la extensión aparecerán acá.
              </p>
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Barra de herramientas */}
      <ClientToolbar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        canvasRef={canvasRef}
        linkedTicketIds={linkedTicketIds}
        onSelectTicket={handleSelectTicket}
      />
    </div>
  );
}
