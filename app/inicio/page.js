import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Code2,
  Download,
  Eraser,
  Gauge,
  Globe,
  Link2,
  MapPin,
  MousePointer2,
  Pin,
  Puzzle,
  StickyNote,
} from "lucide-react";
import IdeaGlowIcon from "../components/IdeaGlowIcon";

export const metadata = {
  title: "FIXEA - Feedback visual directo a tu Kanban",
  description:
    "FIXEA conecta el feedback visual de tus clientes con tu Kanban de desarrollo. Instalá la extensión de Chrome, reportá bugs con un clic y recibí capturas con DOM y resolución incluidos.",
};

const STEPS = [
  {
    number: "01",
    icon: Download,
    title: "Descargá e instalá el ZIP",
    description:
      "Descargá el ZIP de FIXEA y cargalo en chrome://extensions con el Modo desarrollador activo. También vas a poder instalarlo desde la Chrome Web Store.",
  },
  {
    number: "02",
    icon: Pin,
    title: "Fijala en el navegador",
    description:
      "Hacé clic en el ícono en forma de X y fijá a FIXEA en la barra. Vas a tener la herramienta de reportes solo a un clic.",
  },
  {
    number: "03",
    icon: Link2,
    title: "Vinculá el enlace de tu sitio y reportá",
    description:
      "Pegá el enlace de tu web o servidor al crear el proyecto, abrilo en el navegador y señalá cada ajuste con pins, flechas o post-its. Cada reporte llega al instante a tu Kanban.",
  },
];

function FixeaX({ className = "h-4 w-4", color = "#00E5FF" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M5 5 19 19M19 5 5 19"
        stroke={color}
        strokeWidth="4.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const HERO_TOOLS = [
  { icon: MousePointer2, label: "Cursor" },
  { icon: MapPin, label: "Pin", active: true },
  { icon: ArrowUpRight, label: "Flecha" },
  { icon: StickyNote, label: "Post-it" },
  { icon: Eraser, label: "Goma" },
];

const BENEFITS = [
  {
    icon: Gauge,
    title: "80% menos tiempo de feedback",
    description:
      "Sin mails, sin tu galería llena de capturas. El cliente señala el problema directamente sobre la página y el equipo lo recibe listo para trabajar.",
  },
  {
    icon: Code2,
    title: "DOM y resolución automáticos",
    description:
      "Cada ticket viaja con el selector CSS del elemento, la resolución de pantalla, el navegador y la URL exacta donde ocurrió el problema.",
  },
  {
    icon: Globe,
    title: "Vercel y localhost, sin configurar",
    description:
      "FIXEA sincroniza los dominios de tus proyectos. La extensión reconoce el sitio abierto y asocia el reporte al proyecto correcto.",
  },
];

export default function InicioPage() {
  return (
    <div className="min-h-screen bg-[var(--Negro-fondo-1,#0B0C10)] font-sans text-[#F1F5F9]">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-[#252734] bg-[#0B0C10]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/inicio" aria-label="FIXEA" className="flex items-center">
            <Image
              src="/Logo.png"
              alt="FIXEA"
              width={112}
              height={30}
              priority
              className="h-7 w-auto object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-6 text-xs font-semibold text-slate-400 md:flex">
            <a href="#producto" className="transition-colors hover:text-white">
              Producto
            </a>
            <a
              href="#instalacion"
              className="transition-colors hover:text-white"
            >
              Instalación
            </a>
            <a
              href="#beneficios"
              className="transition-colors hover:text-white"
            >
              Beneficios
            </a>
            <Link href="/planes" className="transition-colors hover:text-white">
              Planes
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login?tab=crear"
              className="flex h-10 items-center justify-center rounded-xl border border-[#00E5FF]/50 bg-[#1F2029] px-4 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
            >
              Crear cuenta
            </Link>
            <Link
              href="/login"
              className="flex h-10 items-center justify-center rounded-xl border border-[#2A2C38] bg-[#1F2029] px-4 text-xs font-bold text-slate-300 transition-colors hover:border-[#00E5FF] hover:text-white"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/planes"
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] px-4 text-xs font-black text-[#0B0C10] transition-transform hover:scale-[1.03]"
            >
              Conocé los Planes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section id="producto" className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-[#00E5FF]/12 blur-[130px]" />
            <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-[#7000FF]/18 blur-[130px]" />
            <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-[#FF007F]/10 blur-[130px]" />
          </div>

          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
            <div>
              <h1 className="mt-6 text-4xl font-black leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                Feedback visual directo de tus clientes a tu{" "}
                <span className="bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] bg-clip-text text-transparent">
                  Kanban de desarrollo
                </span>
              </h1>

              <p className="mt-5 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
                Tus clientes señalan el problema sobre la página real. FIXEA
                captura la pantalla, el DOM y el contexto técnico, y lo
                convierte en un ticket listo para tu equipo. Sin fricción, sin
                interpretaciones.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-5 w-5 text-[#00FF66]" strokeWidth={1.75} />
                  Activación inmediata
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-5 w-5 text-[#00FF66]" strokeWidth={1.75} />
                  Sincronización en tiempo real
                </span>
              </div>
            </div>

            <div className="relative pb-10 pl-2 sm:pl-6" aria-hidden="true">
              <div className="rounded-3xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] p-[1.5px] shadow-[0_0_60px_rgba(112,0,255,0.28)]">
                <div className="overflow-hidden rounded-[22px] bg-[#12131A]">
                  <div className="flex items-center gap-2 border-b border-[#252734] bg-[#161822] px-3 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF003C]/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#7000FF]/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#00FF66]/80" />
                    <div className="ml-2 flex-1 truncate rounded-md border border-[#252734] bg-[#0B0C10] px-2.5 py-1 font-mono text-[10px] text-slate-500">
                      https://tu-sitio.com
                    </div>
                  </div>

                  <div className="relative h-80 bg-[radial-gradient(circle_at_18%_12%,#1F2029,#12131A_70%)] p-5">
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-20 rounded bg-[#2A2C38]" />
                      <div className="flex gap-2">
                        <div className="h-2.5 w-10 rounded bg-[#252734]" />
                        <div className="h-2.5 w-10 rounded bg-[#252734]" />
                        <div className="h-2.5 w-10 rounded bg-[#252734]" />
                      </div>
                    </div>
                    <div className="mt-6 h-5 w-48 rounded bg-[#2A2C38]" />
                    <div className="mt-2 h-2.5 w-60 rounded bg-[#252734]" />
                    <div className="mt-1.5 h-2.5 w-40 rounded bg-[#252734]" />
                    <div className="mt-4 h-7 w-24 rounded-lg border border-[#00E5FF]/50 bg-[#00E5FF]/10" />
                    <div className="mt-6 grid w-[78%] grid-cols-3 gap-3">
                      <div className="h-20 rounded-xl border border-[#252734] bg-[#161822]" />
                      <div className="h-20 rounded-xl border border-dashed border-[#FF007F]/60 bg-[#161822]" />
                      <div className="h-20 rounded-xl border border-[#252734] bg-[#161822]" />
                    </div>

                    <svg
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M41 70 C 34 86, 20 92, 12 104"
                        fill="none"
                        stroke="#00E5FF"
                        strokeOpacity="0.55"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>

                    <div className="absolute left-[41%] top-[68%] -translate-x-1/2 -translate-y-1/2">
                      <span className="absolute -inset-2.5 animate-ping rounded-full border-2 border-[#FF007F]/35" />
                      <span className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#FF007F] bg-[#0B0C10] bg-[radial-gradient(circle_at_50%_40%,rgba(255,0,127,0.38),rgba(255,0,127,0.12))] shadow-[0_0_0_3px_rgba(255,0,127,0.18),0_0_22px_#FF007F]">
                        <FixeaX className="h-4 w-4" color="#FF007F" />
                      </span>
                    </div>

                    <div className="absolute left-[46%] top-[34%] w-44 -rotate-2 rounded-xl border border-white/30 bg-[#FF007F] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.5),0_0_24px_rgba(255,0,127,0.45)]">
                      <div className="flex items-center gap-1.5 text-[#0B0C10]">
                        <FixeaX className="h-3 w-3" color="#0B0C10" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0B0C10]" />
                        <span className="flex-1 text-[8px] font-black uppercase tracking-[0.1em]">
                          Pendiente
                        </span>
                        <span className="text-[11px] font-bold leading-none">×</span>
                      </div>
                      <p className="mt-1.5 text-[11px] font-semibold leading-snug text-[#0B0C10]">
                        &quot;Textos los quiero en inglés&quot;
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-2 top-16 rounded-2xl bg-[linear-gradient(180deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] p-[1.5px] shadow-[0_12px_30px_rgba(0,0,0,0.55)] sm:-right-5">
                <div className="flex flex-col items-center gap-1.5 rounded-[14px] bg-[#161822] p-1.5">
                  {HERO_TOOLS.map(({ icon: Icon, label, active }) => (
                    <span
                      key={label}
                      title={label}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        active
                          ? "bg-[#00E5FF]/15 text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.35)]"
                          : "text-slate-400"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    </span>
                  ))}
                </div>
              </div>

              <div className="absolute -bottom-2 left-0 w-56 rounded-xl border border-[#2A2C38] bg-[#1F2029] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.6)] sm:-left-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Kanban · Ticket
                  </span>
                  <span className="rounded-full border border-[#00E5FF]/50 bg-[#00E5FF]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#00E5FF]">
                    Pendiente
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex shrink-0 items-center justify-center rounded-md border border-[#FFD600]/25 bg-[#FFD600]/10 p-1">
                    <IdeaGlowIcon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-[11px] italic leading-snug text-[#F4F4F6]">
                    &quot;Textos los quiero en inglés&quot;
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-[#2A2C38] bg-[#161822] px-2 py-1 text-[9px]">
                  <span className="text-slate-400">Prioridad</span>
                  <span className="flex items-center gap-1 font-bold text-[#FF003C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF003C] shadow-[0_0_6px_#FF003C]" />
                    Alta
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INSTALACIÓN */}
        <section
          id="instalacion"
          className="border-y border-[#252734] bg-[#12131A] py-20"
        >
          <div className="mx-auto max-w-6xl px-5">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#7000FF]/40 bg-[#161822] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#F4F4F6]">
                <Puzzle className="h-3.5 w-3.5 text-[#7000FF]" strokeWidth={2} />
                Onboarding
              </span>
              <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
                De la extensión al primer ticket en 3 pasos
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                No necesitás tocar código ni configurar servidores. La extensión
                se conecta sola con tu Dashboard.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((step) => {
                const Icon = step.icon;

                return (
                  <article
                    key={step.number}
                    className="group rounded-2xl border border-[#252734] bg-[#1F2029] p-6 transition-colors hover:border-[#00E5FF]/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00E5FF]/30 bg-[#161822] text-[#00E5FF] shadow-[0_0_14px_rgba(0,229,255,0.12)]">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="font-mono text-2xl font-black text-white/10">
                        {step.number}
                      </span>
                    </div>
                    <h3 className="mt-4 text-sm font-black text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {step.description}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/documentacion"
                className="flex items-center gap-2 rounded-xl border border-[#00E5FF]/50 bg-[#1F2029] px-4 py-2.5 text-xs font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
              >
                <Download className="h-4 w-4" />
                Ver guía de instalación
              </Link>
              <span className="text-[11px] text-slate-500">
                Compatible con Chrome y navegadores basados en Chromium.
              </span>
            </div>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section id="beneficios" className="py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#FF007F]/40 bg-[#161822] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#F4F4F6]">
                <Gauge className="h-3.5 w-3.5 text-[#FF007F]" strokeWidth={2} />
                Por qué FIXEA
              </span>
              <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">
                Menos ida y vuelta. Más bugs resueltos.
              </h2>
              <p className="mt-3 text-sm text-slate-400">
                El contexto técnico viaja con el reporte, así el equipo de
                desarrollo no tiene que reconstruir qué pasó.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon;

                return (
                  <article
                    key={benefit.title}
                    className="rounded-2xl border border-[#252734] bg-[#1F2029] p-6"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#FF007F]/30 bg-[#161822] text-[#FF007F] shadow-[0_0_14px_rgba(255,0,127,0.12)]">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <h3 className="mt-4 text-sm font-black text-white">
                      {benefit.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {benefit.description}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="mt-10 grid gap-4 rounded-2xl border border-[#00E5FF]/20 bg-[#12131A] p-6 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-3xl font-black text-[#00E5FF]">80%</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  menos tiempo de feedback
                </p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-[#7000FF] [text-shadow:0_0_18px_rgba(112,0,255,0.55)]">3</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  estados claros: Pendiente, En proceso, Finalizado
                </p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-[#FF007F]">1 clic</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  para reportar un bug con contexto completo
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="px-5 pb-20">
          <div className="mx-auto max-w-4xl rounded-3xl bg-[linear-gradient(135deg,#00E5FF_0%,#7000FF_50%,#FF007F_100%)] p-[1.5px] shadow-[0_0_50px_rgba(112,0,255,0.3)]">
            <div className="rounded-[22px] bg-[#0B0C10] px-6 py-12 text-center">
              <h2 className="text-2xl font-black text-white sm:text-3xl">
                Empezá a recibir feedback visual hoy
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
                Creá tu cuenta gratis, conectá tu primer proyecto de Vercel y
                probá el flujo completo con tu cliente.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link
                  href="/login?tab=crear"
                  className="flex items-center gap-2 rounded-xl border border-[#00E5FF]/50 bg-[#1F2029] px-5 py-3 text-sm font-bold text-[#00E5FF] transition-colors hover:border-[#00E5FF] hover:text-white"
                >
                  Crear cuenta
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-xl bg-[#00E5FF] px-5 py-3 text-sm font-black text-[#0B0C10] transition-colors hover:bg-white"
                >
                  Iniciar Sesión
                 
                </Link>
                <Link
                  href="/planes"
                  className="rounded-xl border border-[#2A2C38] px-5 py-3 text-sm font-bold text-slate-300 transition-colors hover:border-[#00E5FF] hover:text-white"
                >
                  Conocé los Planes
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#252734] py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-[11px] text-slate-500 sm:flex-row">
          <span>
            © {new Date().getFullYear()} FIXEA. Todos los derechos reservados.
          </span>
          <div className="flex items-center gap-4">
            <Link href="/planes" className="transition-colors hover:text-white">
              Planes
            </Link>
            <Link
              href="/documentacion"
              className="transition-colors hover:text-white"
            >
              Documentación
            </Link>
            <Link
              href="/soporte"
              className="transition-colors hover:text-white"
            >
              Soporte
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
