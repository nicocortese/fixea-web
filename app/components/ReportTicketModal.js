"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  Send,
  X,
} from "lucide-react";

const PRIORITIES = [
  { value: "Alta", color: "#FF003C" },
  { value: "Media", color: "#FFEA00" },
  { value: "Baja", color: "#00FF66" },
];

export default function ReportTicketModal({
  left,
  top,
  reportType = "REPORTAR PROBLEMA",
  author: initialAuthor = "Cliente",
  submitted = false,
  onSend,
  onClose,
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState(() => {
    if (typeof window === "undefined") return initialAuthor;

    try {
      const stored = window.localStorage.getItem("fixea_author");
      return stored?.trim() || initialAuthor;
    } catch {
      return initialAuthor;
    }
  });
  const [priority, setPriority] = useState("Alta");

  const selectedPriority =
    PRIORITIES.find((option) => option.value === priority) ?? PRIORITIES[0];

  const updateAuthor = (value) => {
    setAuthor(value);

    const trimmed = value.trim();
    if (!trimmed) return;

    try {
      window.localStorage.setItem("fixea_author", trimmed);
    } catch {
      // Ignore storage failures; the name is still used in this request.
    }
  };

  const handleSend = () => {
    if (submitted || !title.trim()) return;

    onSend({
      title: title.trim(),
      author: author.trim() || "Cliente",
      priority,
    });
  };

  return (
    <div
      data-fixea-ui
      style={{ left, top }}
      className="pointer-events-auto absolute z-[60] w-[340px] max-w-[calc(100vw-24px)] rounded-[26px] bg-[linear-gradient(135deg,#00E5FF_0%,#FF007F_100%)] p-[1.5px] shadow-[0_18px_50px_rgba(0,0,0,0.75),0_0_25px_rgba(255,0,127,0.3),0_0_46px_rgba(0,229,255,0.2)]"
    >
      <div className="rounded-[24px] bg-[#1F2029] p-4 text-[#f1f5f9]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.65)]" />
            <h3 className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-white">
              {reportType}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar reporte"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-slate-700/70 bg-[#0B0C10]/60 px-2.5 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#334155,#1F2029)] text-[11px] font-black text-white ring-1 ring-white/20">
            {(author.trim() || "C").charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <input
              data-fixea-ui
              value={author}
              onChange={(event) => updateAuthor(event.target.value)}
              maxLength={40}
              aria-label="Nombre del cliente"
              placeholder="Tu nombre"
              className="w-full bg-transparent text-xs font-semibold text-white placeholder:text-slate-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500">Tu opinión es clave</p>
          </div>
        </div>

        <textarea
          data-fixea-ui
          autoFocus
          rows={3}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={500}
          aria-label="Descripción del reporte"
          placeholder="Cambiá el texto..."
          className="mt-3 w-full resize-none rounded-2xl border border-slate-700/80 bg-[#0B0C10]/80 p-3 text-xs leading-relaxed text-white placeholder:text-slate-500 focus:border-[#00E5FF] focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="relative flex h-9 items-center gap-2 rounded-full border border-slate-700 bg-[#0B0C10]/80 pl-3 pr-8 text-[11px] text-slate-300 transition-colors hover:border-[#00E5FF]/60">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: selectedPriority.color,
                boxShadow: `0 0 8px ${selectedPriority.color}`,
              }}
            />
            <span>Prioridad</span>
            <span
              className="font-bold"
              style={{ color: selectedPriority.color }}
            >
              {priority}
            </span>

            <select
              data-fixea-ui
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-label="Prioridad del ticket"
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>

            <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
          </label>

          <button
            type="button"
            onClick={handleSend}
            disabled={submitted || !title.trim()}
            aria-label="Enviar ticket"
            title="Enviar ticket"
            className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#00E5FF_0%,#FF007F_100%)] p-[1.5px] shadow-[0_0_18px_rgba(0,229,255,0.35)] transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0B0C10] text-white transition-colors group-hover:bg-transparent group-hover:text-[#0B0C10]">
              {submitted ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4 -rotate-12" />
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
