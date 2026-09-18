"use client";
import { ChevronDown } from "lucide-react";
import Image from "next/image";

export default function TicketCard({ onClick, className = "" }) {
  return (
    <div
      onClick={onClick}
      className={`w-60 shrink-0 bg-[#0B0C10] rounded-3xl overflow-hidden border border-[#1F2029] hover:border-cyan-400/60 hover:shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all cursor-pointer flex flex-col justify-between select-none ${className}`}
    >
      {/* Mockup Superior */}
      <div>
        {/* Cabecera blanca estilo Figma */}
        <div className="bg-[#f1f5f9] px-3.5 py-2 flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-[#1b202e] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            S
          </div>
          <span className="text-xs text-[#0f121d] font-bold truncate">
            Sergio Navarro
          </span>
        </div>

        {/* Imagen a pantalla completa */}
        <div className="w-full h-32 relative bg-[#141824] border-b border-slate-800/80">
          <Image
            src="/captura.png"
            alt="Captura"
            fill
            sizes="240px"
            className="object-cover object-top"
          />
        </div>
      </div>

      {/* Contenido inferior oscuro */}
      <div className="p-3">
        {/* Cajita de Prioridad */}
        <div className="flex items-center justify-between rounded-xl px-3 py-1.5 mb-2.5 bg-[#141824] border border-slate-800/80">
          <span className="text-[11px] text-slate-400">Prioridad</span>

          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff0055] shadow-[0_0_8px_#ff0055]" />
            <span className="text-[11px] font-semibold text-[#ff0055]">Alta</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#f1f5f9] ml-0.5" />
          </div>
        </div>

        {/* Texto de sugerencia */}
        <p className="text-xs text-[#f1f5f9] leading-snug line-clamp-2 px-1 pb-0.5">
          El texto del título no es el que yo quería poner, mejor pensemos en otro.
        </p>
      </div>
    </div>
  );
}