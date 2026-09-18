"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ClientToolbar from "../components/ClientToolbar";

export default function ClientePage() {
  const [pinCoords, setPinCoords] = useState(null);
  const [pinningActive, setPinningActive] = useState(true);

  const handleClick = (e) => {
    if (!pinningActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    setPinCoords({ x, y });
  };

  return (
    <div className="relative w-full min-h-screen bg-black select-none overflow-x-hidden">
      
      {/* Botón flotante para regresar a FIXEA */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 bg-[#090b11]/90 border border-cyan-400 text-cyan-400 text-xs px-3 py-1.5 rounded-full font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)] hover:bg-cyan-950 transition-all flex items-center gap-1.5 backdrop-blur-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a FIXEA
      </Link>

      {/* Contenedor interactivo de la captura */}
      <div
        onClick={handleClick}
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

        {/* Halo de luz neón en el punto exacto */}
        {pinCoords && (
          <div
            style={{ left: `${pinCoords.x}px`, top: `${pinCoords.y}px` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          >
            <div className="w-12 h-12 rounded-full bg-cyan-400/30 border-2 border-cyan-400 shadow-[0_0_30px_#00e5ff] animate-ping absolute -inset-0 m-auto" />
            <div className="w-8 h-8 rounded-full bg-[#0B0C10] border-2 border-cyan-400 shadow-[0_0_15px_#00e5ff] flex items-center justify-center text-cyan-400 text-xs font-black relative z-10">
              1
            </div>
          </div>
        )}
      </div>

      {/* Barra de herramientas */}
      <ClientToolbar
        pinCoords={pinCoords}
        pinningActive={pinningActive}
        setPinningActive={setPinningActive}
      />
    </div>
  );
}