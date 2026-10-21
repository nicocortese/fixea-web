"use client";

import { User, Code2, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function LoginModal({ selectRole }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0b0d13] border border-slate-800 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,229,255,0.15)] text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center  justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(0,229,255,0.4)]">
          <Image
            src="/Logo.png"
            alt="FIXEA Logo"
            width={200}
            height={188}
            
          />
        </div>

        <h2 className="text-xl font-black text-[#f1f5f9] uppercase tracking-wider mb-1">
          Bienvenido a FIXEA
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Seleccioná tu sesión para ingresar a la plataforma.
        </p>

        <div className="space-y-3">
          {/* DESARROLLADOR*/}

          <button
            onClick={() => selectRole("dev")}
            className="w-full p-4 rounded-2xl bg-[#141824] border border-slate-800 hover:border-cyan-400/60 hover:bg-cyan-900/30 transition-all flex items-center justify-between group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#f1f5f9] group-hover:text-cyan-400 transition-colors">
                  Sesión Programador
                </p>
                <p className="text-[10px] text-slate-400">
                  Acceso al Dashboard y panel de gestión
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </button>

          {/* CLIENTE */}

          <button
            onClick={() => selectRole("client")}
            className="w-full p-4 rounded-2xl bg-[#141824] border border-slate-800 hover:border-pink-500/60 hover:bg-pink-950/30 transition-all flex items-center justify-between group text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#f1f5f9] group-hover:text-pink-400 transition-colors">
                  Sesión Cliente (Sergio Navarro)
                </p>
                <p className="text-[10px] text-slate-400">
                  Navegación web, reportes y correcciones
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
}
