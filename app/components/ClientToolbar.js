"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  Eraser,
  RotateCcw,
  Grid,
  ArrowRight,
  Highlighter,
  PenTool,
  StickyNote,
  Send,
  Minus,
  Lightbulb,
  Monitor,
  CheckCircle2,
  X,
} from "lucide-react";

export default function ClientToolbar({
  pinCoords,
  pinningActive,
  setPinningActive,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [screenInfo, setScreenInfo] = useState("");

  useEffect(() => {
    if (pinCoords) {
      const timer = setTimeout(() => {
        setShowModal(true);
        if (typeof window !== "undefined") {
          setScreenInfo(`${window.innerWidth}x${window.innerHeight}`);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pinCoords]);

  const handleSend = () => {
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setShowModal(false);
      if (setPinningActive) setPinningActive(false);
    }, 1200);
  };

  return (
    <>
      {/* 1. BOTÓN [+] CERRADO (Abajo a la derecha) */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            if (setPinningActive) setPinningActive(true);
          }}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-2xl bg-[#08090e] flex items-center justify-center border border-transparent shadow-[0_0_20px_rgba(0,0,0,0.8)] relative before:absolute before:-inset-[1.5px] before:-z-10 before:rounded-2xl before:bg-gradient-to-b before:from-cyan-400 before:to-[#ff007f] hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-6 h-6 text-white stroke-[2.5]" />
        </button>
      )}

      {/* 2. BARRA DESPLEGADA (Abajo a la derecha, en el mismo lugar) */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#08090e] rounded-full py-3 px-1.5 flex flex-col items-center gap-2.5 shadow-[0_0_30px_rgba(0,0,0,0.9)] border border-transparent relative before:absolute before:-inset-[1.5px] before:-z-10 before:rounded-full before:bg-gradient-to-b before:from-cyan-400 before:via-purple-500 before:to-[#ff007f]">
          {/* 1. Goma */}
          <button className="p-1 text-slate-300 hover:text-cyan-400 transition-colors">
            <Eraser className="w-4 h-4" />
          </button>

          {/* 2. Deshacer */}
          <button className="p-1 text-slate-300 hover:text-cyan-400 transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* 3. Cuadrícula */}
          <button className="p-1 text-slate-300 hover:text-cyan-400 transition-colors">
            <Grid className="w-4 h-4" />
          </button>

          {/* 4. Flecha */}
          <button className="p-1 text-slate-300 hover:text-cyan-400 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* 5. Resaltador */}
          <button className="p-1 text-slate-300 hover:text-cyan-400 transition-colors">
            <Highlighter className="w-4 h-4" />
          </button>

          {/* 6. Pluma */}
          <button className="p-1 text-cyan-400 hover:text-white transition-colors">
            <PenTool className="w-4 h-4" />
          </button>

          {/* 7. Nota / Sticker */}
          <button className="p-1 text-slate-300 hover:text-cyan-400 transition-colors">
            <StickyNote className="w-4 h-4" />
          </button>

          {/* 8. Enviar feedback */}
          <button
            onClick={() => setShowModal(true)}
            className="p-1 text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>

          {/* Separador */}
          <div className="w-4 h-[1px] bg-slate-800 my-0.5" />

          {/* 9. Guion para colapsar */}
          <button
            onClick={() => {
              setIsOpen(false);
              if (setPinningActive) setPinningActive(false);
            }}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Colapsar"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. POP-UP FLOTANTE AL LADO DEL PIN (Sin blur en el fondo) */}
      {showModal && pinCoords && (
        <div
          style={{
            left: `${Math.min(
              pinCoords.x + 24,
              typeof window !== "undefined" ? window.innerWidth - 380 : pinCoords.x + 24
            )}px`,
            top: `${Math.max(pinCoords.y - 40, 20)}px`,
          }}
          className="absolute z-50 w-80 sm:w-96 bg-[#0B0C10] text-[#f1f5f9] rounded-3xl p-5 border border-cyan-400/80 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(0,229,255,0.3)] select-none"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-cyan-400">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              NUEVO TICKET #01
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#141824] rounded-xl p-2.5 mb-3 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Punto seleccionado:</span>
              <span className="font-mono text-cyan-300">
                X: {pinCoords.x}px | Y: {pinCoords.y}px
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1">
                <Monitor className="w-3 h-3 text-slate-500" /> Pantalla:
              </span>
              <span className="font-mono text-slate-300">{screenInfo}</span>
            </div>
          </div>

          <textarea
            rows={3}
            defaultValue="El texto del título no es el que yo quería poner, mejor pensemos en otro."
            className="w-full bg-[#141824] border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none mb-3"
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">Prioridad:</span>
              <span className="font-bold text-[#ff0055]">Alta</span>
            </div>

            <button
              onClick={handleSend}
              className="px-4 py-2 bg-gradient-to-r from-cyan-400 to-pink-500 hover:opacity-90 rounded-xl font-black text-xs text-black flex items-center gap-1.5 shadow-md transition-all"
            >
              {submitted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> ¡ENVIADO!
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> ENVIAR TICKET
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}