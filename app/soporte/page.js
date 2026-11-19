"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Bug,
  Check,
  Copy,
  Headphones,
  Mail,
  MessageSquareText,
} from "lucide-react";
import Link from "next/link";
import SectionShell, { Panel } from "../components/sections/SectionShell";

const SUPPORT_EMAIL = "nicolascortese2004@gmail.com";

const CHANNELS = [
  {
    icon: Bug,
    color: "#FF003C",
    title: "Reportar un error",
    description:
      "Contanos qué pasó, en qué URL y con qué navegador. Si podés, sumá una captura o el texto del toast que viste.",
  },
  {
    icon: MessageSquareText,
    color: "#00E5FF",
    title: "Consultas de uso",
    description:
      "Dudas sobre proyectos, invitaciones, la Key o el flujo Pendiente → En proceso → Finalizado.",
  },
  {
    icon: BookOpen,
    color: "#7000FF",
    title: "Documentación",
    description:
      "La guía de instalación y vinculación resuelve la mayoría de los problemas con la extensión.",
    href: "/documentacion",
  },
];

// === Soporte ===
export default function SoportePage() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <SectionShell
      icon={Headphones}
      accent="#00FF66"
      title="Soporte"
      subtitle="Contacto directo con el creador de FIXEA."
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] p-[1.5px] shadow-[0_0_40px_rgba(112,0,255,0.22)]">
          <div className="h-full rounded-[15px] bg-[#12131A] p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Creador de FIXEA
            </p>
            <h2 className="mt-2 text-xl font-black text-white">Nicolás Cortese</h2>

            <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#2A2C38] bg-[#161822] px-4 py-3">
              <Mail className="h-4 w-4 shrink-0 text-[#00E5FF]" strokeWidth={1.75} />
              <span className="min-w-0 flex-1 break-all font-mono text-sm text-[#F4F4F6]">
                {SUPPORT_EMAIL}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={copyEmail}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors ${
                  copied
                    ? "border-[#00FF66] bg-[#00FF66]/10 text-[#00FF66]"
                    : "border-[#2A2C38] bg-[#161822] text-slate-200 hover:border-[#00E5FF]/60 hover:text-white"
                }`}
              >
                {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
                {copied ? "¡Correo copiado!" : "Copiar correo"}
              </button>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Soporte FIXEA")}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] px-4 py-2.5 text-xs font-black text-[#0B0C10] transition-transform hover:scale-[1.02]"
              >
                <Mail className="h-4 w-4" strokeWidth={2} />
                Escribir un mail
              </a>
            </div>

            <p className="mt-4 text-xs text-slate-500" aria-live="polite">
              {copied ? "Listo: pegalo en tu cliente de correo." : "Copiá el correo o escribí directo desde tu cliente de mail."}
            </p>
          </div>
        </div>

        <Panel title="Guía rápida de canales">
          <ul className="space-y-3">
            {CHANNELS.map(({ icon: Icon, color, title, description, href }) => (
              <li key={title} className="flex gap-3 rounded-xl border border-[#252734] bg-[#161822] p-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-[#12131A]"
                  style={{ borderColor: `${color}55`, color }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">
                    {href ? (
                      <Link href={href} className="hover:text-[#00E5FF]">{title} →</Link>
                    ) : (
                      title
                    )}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </SectionShell>
  );
}
