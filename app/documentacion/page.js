import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eraser,
  FileText,
  Link2,
  MapPin,
  MoveUpRight,
  Pin,
  Puzzle,
  StickyNote,
} from "lucide-react";
import SectionShell, { Panel } from "../components/sections/SectionShell";

export const metadata = {
  title: "FIXEA - Documentación",
  description:
    "Propuesta de valor, flujo de estados e instalación paso a paso de la extensión de Chrome de FIXEA.",
};

const VALUE_POINTS = [
  "El cliente marca el problema sobre su sitio real, sin capturas ni mails.",
  "Cada reporte llega al Kanban con captura, URL, selector del elemento y navegador.",
  "El cliente aprueba la corrección desde su propio sitio: el cierre queda auditado.",
];

const STATES = [
  {
    key: "PENDIENTE",
    label: "Pendiente",
    color: "#00E5FF",
    who: "Cliente",
    description: "El cliente crea la corrección con la extensión y llega al tablero del programador.",
  },
  {
    key: "EN_PROCESO",
    label: "En proceso",
    color: "#7000FF",
    who: "Programador",
    description: "El programador aplica el cambio y envía la solución: el cliente la ve en su sitio.",
  },
  {
    key: "FINALIZADO",
    label: "Finalizado",
    color: "#00FF66",
    who: "Cliente",
    description: "El cliente verifica y aprueba. Si sigue roto, vuelve a Pendiente.",
  },
];

const INSTALL_STEPS = [
  {
    icon: Download,
    title: "Descargá la extensión",
    description: "Descomprimí el ZIP de FIXEA en una carpeta de tu computadora.",
  },
  {
    icon: Puzzle,
    title: "Cargala en Chrome",
    description:
      "Abrí chrome://extensions, activá el Modo desarrollador y elegí «Cargar descomprimida» seleccionando esa carpeta.",
  },
  {
    icon: Pin,
    title: "Fijala en la barra",
    description: "Desde el ícono del rompecabezas, fijá FIXEA para tenerla siempre a un clic.",
  },
  {
    icon: Link2,
    title: "Vinculá tu sitio",
    description:
      "Al crear el proyecto pegá la URL de tu sitio: staging, Vercel (https://tu-sitio.vercel.app) o localhost en cualquier puerto.",
  },
  {
    icon: CheckCircle2,
    title: "Abrí el sitio y reportá",
    description:
      "La extensión reconoce la URL y muestra la barra de herramientas. Cada reporte aparece al instante en el Kanban.",
  },
];

const TOOLS = [
  { icon: MapPin, color: "#00E5FF", title: "Pin", description: "Un clic marca el punto exacto del problema." },
  { icon: MoveUpRight, color: "#FF007F", title: "Flecha", description: "Arrastrá para señalar un elemento o un recorrido." },
  { icon: StickyNote, color: "#7000FF", title: "Post-it", description: "Nota de color con el comentario: se minimiza en una X." },
  { icon: Eraser, color: "#FF003C", title: "Goma", description: "Borra cualquier marca de la página y su ticket." },
];

// === Documentación ===
export default function DocumentacionPage() {
  return (
    <SectionShell
      icon={FileText}
      accent="#7000FF"
      title="Documentación"
      subtitle="Qué resuelve FIXEA, cómo fluyen los tickets y cómo instalar la extensión."
    >
      <div className="space-y-4">
        <Panel title="Propuesta de valor">
          <ul className="grid gap-3 md:grid-cols-3">
            {VALUE_POINTS.map((point) => (
              <li key={point} className="flex gap-2.5 rounded-xl border border-[#252734] bg-[#161822] p-3 text-xs leading-relaxed text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00FF66]" strokeWidth={1.75} />
                {point}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Flujo de estados">
          <ol className="grid gap-3 md:grid-cols-3">
            {STATES.map((state, index) => (
              <li key={state.key} className="relative rounded-xl border bg-[#161822] p-4" style={{ borderColor: `${state.color}55` }}>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#F4F4F6]">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: state.color, boxShadow: `0 0 8px ${state.color}` }} />
                    {state.label}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{state.who}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{state.description}</p>
                {index < STATES.length - 1 && (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-slate-600 md:block" strokeWidth={2} />
                )}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Instalación y vinculación paso a paso">
          <ol className="space-y-3">
            {INSTALL_STEPS.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="flex gap-4 rounded-xl border border-[#252734] bg-[#161822] p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00E5FF]/30 bg-[#12131A] text-[#00E5FF]">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-black text-white">
                    <span className="mr-2 font-mono text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Herramientas de anotación">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map(({ icon: Icon, color, title, description }) => (
              <li key={title} className="rounded-xl border border-[#252734] bg-[#161822] p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border bg-[#12131A]" style={{ borderColor: `${color}55`, color }}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <p className="mt-3 text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </SectionShell>
  );
}
