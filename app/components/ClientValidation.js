"use client";

import { useEffect } from "react";
import { CheckCircle2, RotateCcw, X, ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/formatDate";

export default function ClientValidation({
  ticket,
  onApprove,
  onReject,
  onClose,
  isUpdating = false,
}) {
  // Escape cierra la revisión igual que el botón X.
  useEffect(() => {
    if (!ticket) return;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (onClose) onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ticket, onClose]);

  if (!ticket) return null;

  // El estado manda la acción disponible: solo un ticket que el programador
  // puso EN PROCESO se puede verificar o rechazar.
  const status = typeof ticket.status === "string" ? ticket.status : "PENDIENTE";
  const isInProgress = status === "EN_PROCESO";
  const isFinished = status === "FINALIZADO";

  const formattedCreatedAt = formatDateTime(ticket.createdAt);
  const formattedUpdatedAt = formatDateTime(ticket.updatedAt);
  const formattedVerifiedAt = formatDateTime(ticket.verifiedAt);
  const verifiedByName =
    typeof ticket.verifiedByName === "string" ? ticket.verifiedByName.trim() : "";

  const metadata =
    ticket.metadata &&
    typeof ticket.metadata === "object" &&
    !Array.isArray(ticket.metadata)
      ? ticket.metadata
      : null;
  const metaText = (value) =>
    typeof value === "string" ? value.trim() : "";
  const metaSelector = metaText(metadata?.selector);
  const metaResolution = metaText(metadata?.screenResolution);
  const metaBrowser = metaText(metadata?.browserInfo);
  const metaUrl = metaText(metadata?.url);
  const hasMetadata = !!(metaSelector || metaResolution || metaBrowser || metaUrl);

  const handleAction = (type) => {
    if (isUpdating) return;
    if (type === "approve") {
      onApprove();
    } else {
      onReject();
    }
  };

  return (
    <>
      <div
        data-fixea-ui
        data-client-validation
        role="dialog"
        aria-modal="true"
        aria-label="Revisión de corrección"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute top-12 left-1/2 -translate-x-1/2 z-50 p-4 text-[#f1f5f9] text-xs animate-in fade-in zoom-in-95 duration-150"
        style={{
          width: 226,
          height: 237,
          borderRadius: 20,
          backgroundColor: "#0B0C10",
          outline: "3px solid #00E5FF",
          boxShadow: "0px 0px 10px #2990FF",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-bold text-[#00E5FF] uppercase tracking-wider text-[10px]">
            {isFinished
              ? "Corrección verificada"
              : isInProgress
                ? "Verificar corrección"
                : "Reporte pendiente"}
          </span>
          <button
            type="button"
            onClick={(e) => {
              // Sin stopPropagation el clic burbujea al pin contenedor, que
              // vuelve a abrir este mismo modal en el mismo evento.
              e.stopPropagation();
              onClose();
            }}
            aria-label="Cerrar revisión"
            className="text-[#f1f5f9] hover:text-slate-400 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-3 space-y-2">
          <div>
            <p className="text-[10px] text-slate-400">Tu reporte original:</p>
            <p className="text-[#f1f5f9] italic font-medium leading-snug mt-1">
              {ticket.title || "Sin descripción"}
            </p>
          </div>

          {(formattedCreatedAt || formattedUpdatedAt) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
              {formattedCreatedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  Creado: {formattedCreatedAt}
                </span>
              )}

              {formattedUpdatedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  Actualizado: {formattedUpdatedAt}
                </span>
              )}
            </div>
          )}

          {hasMetadata && (
            <div className="rounded-xl bg-[#1F2029] border border-slate-800 p-2 space-y-1 text-[10px] text-slate-400">
              <p className="text-[#00E5FF] font-semibold">Metadatos</p>

              {metaSelector && (
                <p
                  className="font-mono text-slate-300 break-all max-h-16 overflow-y-auto"
                  title={metaSelector}
                >
                  {metaSelector}
                </p>
              )}

              {metaResolution && <p>Resolución: {metaResolution}</p>}

              {metaBrowser && (
                <p className="truncate" title={metaBrowser}>
                  {metaBrowser}
                </p>
              )}

              {metaUrl && (
                <p className="font-mono truncate" title={metaUrl}>
                  {metaUrl}
                </p>
              )}
            </div>
          )}

          <div className="p-3 rounded-xl bg-[#1F2029] border border-slate-800 space-y-1">
            <p className="text-[10px] text-[#00E5FF] font-semibold">
              Respuesta técnica del programador:
            </p>
            <p className="text-slate-300 text-[11px] leading-snug">
              {ticket.devNote ||
                "El equipo todavía no dejó una nota técnica."}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 space-y-3">
          {isInProgress ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAction("reject")}
                  disabled={isUpdating}
                  className="py-2 rounded-xl border border-[#FF003C]/40 text-[#FF003C] hover:bg-[#FF003C]/30 font-bold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Sigue roto</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction("approve")}
                  disabled={isUpdating}
                  className="py-2 rounded-xl bg-[#00E5FF] hover:bg-[#00E5FF] text-[#1F2029] font-black flex items-center justify-center gap-1 transition-all shadow-[0_0_12px_rgba(0,229,255,0.3)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="text-[10px] uppercase leading-tight">
                    {isUpdating ? "Verificando..." : "Verificar / Aprobar corrección"}
                  </span>
                </button>
              </div>

              <p className="text-[10px] text-[#f1f5f9] text-center leading-normal px-2">
                * Si marcás{" "}
                <span className="text-[#FF003C] font-semibold">
                  &quot;Sigue roto&quot;
                </span>
                , el ticket reingresará a la columna de pendientes y se notificará
                al desarrollador para su revisión.
              </p>
            </>
          ) : isFinished ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 rounded-xl border border-[#00FF66]/30 bg-[#00FF66]/10 px-3 py-2 text-[10px] text-[#00FF66]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Ya aprobaste esta corrección. El ticket quedó finalizado.
                </span>
              </div>

              {(formattedVerifiedAt || verifiedByName) && (
                <p className="px-1 text-[10px] text-slate-400">
                  {verifiedByName ? `Cerrado por ${verifiedByName}` : "Cerrado"}
                  {formattedVerifiedAt ? ` · ${formattedVerifiedAt}` : ""}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#0B0C10]/40 px-3 py-2 text-[10px] text-slate-400">
              El programador todavía no tomó este reporte. Cuando envíe una
              corrección vas a poder verificarla desde acá.
            </div>
          )}
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] text-slate-400 hover:text-[#00E5FF] transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Volver al inicio</span>
          </Link>
        </div>
      </div>
    </>
  );
}
