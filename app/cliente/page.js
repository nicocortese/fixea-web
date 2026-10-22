"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ClientValidation from "../components/ClientValidation";

// La toolbar depende de window/localStorage (posición del modal, colores
// guardados), así que se renderiza solo en el cliente.
const ClientToolbar = dynamic(() => import("../components/ClientToolbar"), {
  ssr: false,
});

export default function ClientePage() {
  const router = useRouter();
  const [pinningActive, setPinningActive] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [activePin, setActivePin] = useState(null);

  const [activeTicket, setActiveTicket] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  // Marca el montaje en cliente antes de renderizar datos que dependen de la
  // URL o de la sesión, para que SSR y cliente coincidan.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

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

  const handleLogOut = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("fixea_session_role");
    }
    router.push("/");
  };

  if (!isMounted) {
    return <div className="min-h-screen w-full bg-[#0b0f19]" aria-hidden="true" />;
  }

  return (
    <div className="relative w-full min-h-screen bg-black select-none overflow-x-hidden">
      {notice && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] font-bold px-5 py-2.5 rounded-full text-xs shadow-[0_0_20px_rgba(0,0,0,0.6)] backdrop-blur-md ${
            notice.type === "error"
              ? "bg-red-950 border border-red-500 text-red-300"
              : "bg-cyan-950 border border-cyan-400 text-cyan-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Botón Volver a la izquierda */}
      <Link
        className="fixed top-4 left-4 z-50 bg-[#090b11]/90 border border-cyan-400 text-cyan-400 text-xs px-3.5 py-1.5 rounded-full font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)] hover:bg-cyan-950 transition-all flex items-center gap-1.5 backdrop-blur-sm"
        href="/"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a FIXEA
      </Link>

      <button
        onClick={handleLogOut}
        className="fixed top-4 right-4 z-50 bg-[#090b11]/90 border border-slate-700 text-slate-300 hover:border-red-400 hover:text-red-400 text-xs px-3.5 py-1.5 rounded-full font-bold shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all backdrop-blur-sm cursor-pointer"
      >
        <span>Cambiar sesión</span>
      </button>

      {/* Contenedor interactivo de la captura. El padding superior reserva espacio
          para que los botones fijos no tapen el header del sitio embebido. */}
      <div className="pt-16">
        <div
          className={`relative w-full ${pinningActive ? "cursor-crosshair" : "cursor-default"}`}
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
            style={{ left: `580px`, top: `195px` }}
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
        pinningActive={pinningActive}
        setPinningActive={setPinningActive}
      />
    </div>
  );
}
