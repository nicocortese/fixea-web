import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  MousePointerClick,
  Pin,
  Puzzle,
} from "lucide-react";

export const metadata = {
  title: "FIXEA - Guía de instalación",
  description:
    "Instalá la extensión de Chrome de FIXEA y conectá tu primer proyecto de Vercel o localhost en tres pasos.",
};

const STEPS = [
  {
    number: "01",
    icon: Download,
    title: "Descargá e instalá el ZIP",
    description:
      "Descomprimí el ZIP de FIXEA y abrí chrome://extensions. Activá el Modo desarrollador, elegí «Cargar descomprimida» y seleccioná la carpeta de la extensión.",
  },
  {
    number: "02",
    icon: Pin,
    title: "Fijala en el navegador",
    description:
      "Hacé clic en el ícono del rompecabezas de Chrome y fijá FIXEA en la barra. Así tenés la herramienta de reportes siempre a mano.",
  },
  {
    number: "03",
    icon: MousePointerClick,
    title: "Abrí tu sitio y reportá",
    description:
      "Entrá a tu proyecto en Vercel o en localhost, abrí el popup de FIXEA y activá «Nueva observación». Marcá el problema, escribí el detalle y creá el ticket.",
  },
];

const REQUIREMENTS = [
  "Chrome o cualquier navegador basado en Chromium (Edge, Brave, Opera).",
  "Un proyecto creado en el Dashboard con su URL de Vercel o localhost.",
  "La sesión de FIXEA iniciada en el navegador para que la extensión detecte el proyecto activo.",
];

export default function DocumentacionPage() {
  return (
    <div className="min-h-screen bg-[var(--Negro-fondo-1,#0B0C10)] font-sans text-[#F1F5F9]">
      <header className="border-b border-white/5 bg-[#0B0C10]/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link
            href="/inicio"
            className="text-xs font-bold text-slate-400 transition-colors hover:text-white"
          >
            ← Volver al inicio
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-slate-700 px-3.5 py-1.5 text-xs font-bold text-slate-300 transition-colors hover:border-[#00E5FF] hover:text-white"
          >
            Iniciar Sesión
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-20 pt-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#00E5FF]/40 bg-[#00E5FF]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#00E5FF]">
          <Puzzle className="h-3.5 w-3.5" />
          Onboarding
        </span>

        <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
          De la extensión al primer ticket
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Esta guía te lleva desde la instalación hasta el primer reporte
          visual. No necesitás tocar código ni configurar servidores: el
          Dashboard sincroniza el proyecto activo con la extensión.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((step) => {
            const Icon = step.icon;

            return (
              <article
                key={step.number}
                className="rounded-2xl border border-slate-800 bg-[#1F2029] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00E5FF]/30 bg-[#00E5FF]/10 text-[#00E5FF]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="font-mono text-2xl font-black text-white/10">
                    {step.number}
                  </span>
                </div>
                <h2 className="mt-4 text-sm font-black text-white">
                  {step.title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-[#0F1015] p-6">
          <h2 className="text-sm font-black text-white">Antes de empezar</h2>
          <ul className="mt-4 space-y-2.5">
            {REQUIREMENTS.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs leading-relaxed text-slate-400"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF66]" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-2xl border border-[#FFEA00]/25 bg-[#FFEA00]/5 p-6">
          <h2 className="text-sm font-black text-white">
            Si la extensión dice «Conectá FIXEA con tu Dashboard»
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Significa que no hay un proyecto activo vinculado a ese sitio. Abrí
            el Dashboard, creá o seleccioná un proyecto y verificá que la URL
            objetivo coincida con el dominio que estás revisando (por ejemplo
            <span className="text-slate-200"> https://mi-app.vercel.app</span> o
            <span className="text-slate-200"> http://localhost:3000</span>).
            Después recargá la pestaña del sitio.
          </p>
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] px-5 py-3 text-sm font-black text-[#0B0C10] shadow-[0_0_30px_rgba(0,229,255,0.3)] transition-transform hover:scale-[1.02]"
          >
            Ir al Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/planes"
            className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-[#00E5FF] hover:text-white"
          >
            Conocé los Planes
          </Link>
        </div>
      </main>
    </div>
  );
}
