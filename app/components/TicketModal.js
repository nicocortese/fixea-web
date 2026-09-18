"use client";
import Image from "next/image";

import {
  X,
  Link2,
  Code2,
  Monitor,
  Globe,
  Folder,
  Clock,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import { useEffect } from "react";

export default function TicketModal({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#0c0e17] rounded-3xl overflow-hidden neon-border-gradient shadow-2xl relative"
      >
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-slate-900 text-white hover:bg-slate-800"
        >
          <X className="w-4 h-4 cursor-pointer" />
        </button>

        {/* Imagen con altura más chica (h-44) para que no empuje el contenido */}
        <div className="w-full h-56 bg-slate-950 border-b border-slate-800 relative">
          {" "}
          <Image
            src="/captura.png"
            alt="Captura técnica"
            fill
            className="object-cover object-top"
          />
        </div>

        <div className="p-5">
          <h2 className="text-base font-bold text-white mb-3">
            <span className="font-normal text-slate-300">Proyecto:</span>
            <span className="font-extrabold text-white text-lg">
              Retro Kicks
            </span>
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Columna izquierda */}
            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl border border-slate-800 bg-[#141824] flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-xs text-white leading-tight italic">
                  El texto del título no es el que yo quería poner, mejor
                  pensemos en otro
                </p>
              </div>

              <div className="bg-[#141824] border border-slate-800 px-3 py-2 rounded-xl flex items-center justify-between text-xs text-white">
                <span className="flex items-center gap-2 font-medium uppercase text-slate-200">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-slate-300" />
                  PENDIENTE
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </div>

              <div className="rounded-xl px-3 py-2 border border-slate-800 bg-[#141824] flex items-center justify-between text-xs text-white">
                <span className="text-slate-400">Prioridad</span>
                <span className="flex items-center gap-1.5 font-bold text-[#00ff66]">
                  <div className="w-2 h-2 rounded-full bg-[#00ff66]" />
                  Baja
                </span>
              </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 truncate">
                <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-mono text-slate-300 truncate">
                  URL: /retro-kicks
                </span>
              </div>

              <div className="flex items-start gap-2">
                <Code2 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <span className="font-mono text-[10px] text-white bg-slate-900 p-1.5 rounded-lg border border-slate-800 break-all">
                  {"<h2 id='modelo-destacado' class='subtitulo-producto'>"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>1920x1080 (Desktop)</span>
              </div>

              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Chrome 120 / Windows 11</span>
              </div>

              <div className="flex items-center gap-2">
                <Folder className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="font-mono text-white">/productos/[id]</span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>13 de Agosto de 2026, 11:30 hs</span>
              </div>
            </div>
          </div>

          {/* Botón corregir */}
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-200 text-black font-black text-xs tracking-widest uppercase transition-all"
            >
              CORREGIR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
