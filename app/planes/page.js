import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  Infinity as InfinityIcon,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export const metadata = {
  title: "Planes - FIXEA",
  description:
    "Compará el plan gratuito de FIXEA con FIXEA PRO: proyectos ilimitados, notificaciones automáticas y gestión de equipos.",
};

const FREE_FEATURES = [
  "1 proyecto activo",
  "Extensión de navegador para correcciones",
  "Panel de control para organizar tareas",
  "Herramientas centrales de trabajo",
];

const PRO_FEATURES = [
  "Proyectos ilimitados",
  "Notificaciones automáticas",
  "Gestión avanzada de equipos",
  "Identidad visual distintiva",
  "Entorno estandarizado y profesional",
];

export default function PlanesPage() {
  return (
    <div className="min-h-screen bg-[var(--Negro-fondo-1,#0B0C10)] font-sans text-[#F1F5F9]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-0 h-80 w-80 rounded-full bg-[#00E5FF]/10 blur-[120px]" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[#7000FF]/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#FF007F]/10 blur-[120px]" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link href="/" aria-label="Volver al Dashboard" className="flex items-center gap-2">
          <Image
            src="/Logo.png"
            alt="FIXEA"
            width={112}
            height={30}
            priority
            className="h-7 w-auto object-contain"
          />
        </Link>

        <Link
          href="/"
          className="flex items-center gap-2 rounded-full border border-slate-700 px-3.5 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:border-[#00E5FF] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al inicio
        </Link>
      </header>

      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-20">
        <section className="pt-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#00E5FF]">
            <Zap className="h-3.5 w-3.5" />
            Planes FIXEA
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-3xl font-black leading-tight text-white sm:text-4xl">
            Elegí cómo escalar el feedback visual de tus clientes
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
            Comprobá la agilización del trabajo con el plan inicial y pasate a FIXEA PRO para llevar la gestión a un nivel profesional.
          </p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          {/* PLAN GRATUITO */}
          <article className="flex flex-col rounded-3xl border border-slate-800 bg-[#1F2029] p-7 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-300">
                Plan Gratuito
              </h2>
              <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-bold text-slate-400">
                Inicial
              </span>
            </div>

            <div className="mt-6 flex items-end gap-1">
              <span className="text-5xl font-black leading-none text-white">$0</span>
              <span className="pb-1 text-xs font-semibold text-slate-400">
                /mes
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Incluye las herramientas centrales para empezar a trabajar y comprobar la agilidad de la plataforma.
            </p>

            <ul className="mt-6 flex-1 space-y-2.5">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00FF66]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/login"
              className="mt-7 flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 transition-colors hover:border-[#00E5FF] hover:text-white"
            >
              Empezar gratis
            </Link>
          </article>

          {/* FIXEA PRO */}
          <article className="relative rounded-3xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] p-[1.5px] shadow-[0_0_45px_rgba(112,0,255,0.35)]">
            <div className="flex h-full flex-col rounded-[22px] bg-[#0B0C10] p-7">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-white">
                  <Sparkles className="h-4 w-4 text-[#00E5FF]" />
                  FIXEA PRO
                </h2>
                <span className="rounded-full bg-[linear-gradient(135deg,#00E5FF,#7000FF,#FF007F)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                  Recomendado
                </span>
              </div>

              <div className="mt-6 flex items-end gap-1">
                <span className="text-5xl font-black leading-none text-white">
                  $20
                </span>
                <span className="pb-1 text-xs font-semibold text-slate-400">
                  /mes
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Todo operando bajo una identidad distintiva para garantizar un entorno de trabajo estandarizado.
              </p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {PRO_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-slate-200">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00E5FF]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <InfinityIcon className="h-3.5 w-3.5 text-[#00E5FF]" />
                  Proyectos ilimitados
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-[#FF007F]" />
                  Gestión de equipos
                </span>
              </div>

              <Link
                href="/soporte?plan=pro"
                className="mt-7 flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#0B0C10] transition-transform hover:scale-[1.02]"
              >
                Contratar FIXEA PRO
              </Link>
            </div>
          </article>
        </section>

        <p className="mt-10 text-center text-[11px] text-slate-500">
          ¿Necesitás un plan para agencias o varias marcas?{" "}
          <Link href="/soporte" className="font-semibold text-[#00E5FF] hover:underline">
            Hablá con el equipo
          </Link>
          .
        </p>
      </main>
    </div>
  );
}