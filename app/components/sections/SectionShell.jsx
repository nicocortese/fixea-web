import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

// === Estructura común de las secciones del programador ===
export default function SectionShell({ icon: Icon, accent = "#00E5FF", title, subtitle, actions, children }) {
  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#F4F4F6]">
      <header className="sticky top-0 z-30 border-b border-[#252734] bg-[#0B0C10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
          <Link href="/" aria-label="Volver al Dashboard" className="flex items-center">
            <Image src="/Logo.png" alt="FIXEA" width={112} height={30} className="h-7 w-auto object-contain" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[#2A2C38] bg-[#161822] px-3.5 py-2 text-xs font-bold text-slate-300 transition-colors hover:border-[#00E5FF]/60 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Volver al Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl border bg-[#161822]"
                style={{ borderColor: `${accent}55`, color: accent, boxShadow: `0 0 18px ${accent}22` }}
              >
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
            )}
            <div>
              <h1 className="text-2xl font-black text-white">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}

export function Panel({ title, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-[#2A2C38] bg-[#12131A] p-5 ${className}`}>
      {title && (
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, color = "#00E5FF" }) {
  return (
    <div className="rounded-2xl border border-[#2A2C38] bg-[#12131A] p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black" style={{ color }}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value, color = "#00E5FF" }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#161822]">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${width}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}66` }}
      />
    </div>
  );
}

export function StateMessage({ loading, error, empty, onRetry, children }) {
  if (loading) {
    return <p className="rounded-2xl border border-[#2A2C38] bg-[#12131A] p-8 text-center text-sm text-slate-400">Cargando datos…</p>;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-[#FF003C]/40 bg-[#12131A] p-6 text-center">
        <p className="text-sm font-semibold text-[#FF003C]">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl border border-[#2A2C38] bg-[#161822] px-4 py-2 text-xs font-bold text-slate-300 hover:border-[#00E5FF]/60 hover:text-white"
          >
            Reintentar
          </button>
        )}
      </div>
    );
  }
  if (empty) {
    return <p className="rounded-2xl border border-[#2A2C38] bg-[#12131A] p-8 text-center text-sm text-slate-400">{empty}</p>;
  }
  return children;
}
