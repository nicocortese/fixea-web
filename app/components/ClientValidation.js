"use client";

import { CheckCircle2, RotateCcw, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ClientValidation({
  ticket,
  onApprove,
  onReject,
  onClose,
  isUpdating = false,
}) {
  if (!ticket) return null;

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
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-80 bg-[#141824] border border-cyan-500/40 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8), 0_0_20px_rgba(0,229,255,0.2)] p-4 text-[#f1f5f9] text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-bold text-cyan-400 uppercase tracking-wider text-[10px]">
            Revisión de corrección
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#f1f5f9] hover:text-slate-400 p-1 rounded-lg"
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

          <div className="p-3 rounded-xl bg-[#141824] border border-slate-800 space-y-1">
            <p className="text-[10px] text-cyan-400 font-semibold">
              Respuesta técnica del programador:
            </p>
            <p className="text-slate-300 text-[11px] leading-snug">
              {ticket.devNote ||
                "El equipo todavía no dejó una nota técnica."}
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleAction("reject")}
              disabled={isUpdating}
              className="py-2 rounded-xl border border-red-500/40 text-[#ff0055] hover:bg-[#ff0055]/30 font-bold flex items-center justify-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Sigue roto</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction("approve")}
              disabled={isUpdating}
              className="py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#0c0e17] font-black flex items-center justify-center gap-1 transition-all shadow-[0_0_12px_rgba(0,229,255,0.3)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{isUpdating ? "Actualizando..." : "Aprobar fix"}</span>
            </button>
          </div>

          <p className="text-[10px] text-[#f1f5f9] text-center leading-normal px-2">
            * Si marcás{" "}
            <span className="text-red-400 font-semibold">
              &quot;Sigue roto&quot;
            </span>
            , el ticket reingresará a la columna de pendientes y se notificará
            al desarrollador para su revisión.
          </p>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[10px] text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Volver al Dashboard</span>
          </Link>
        </div>
      </div>
    </>
  );
}
