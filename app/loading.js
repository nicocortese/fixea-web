import FixeaLoader from "./components/FixeaLoader";

// Transición entre rutas del App Router: se muestra mientras carga el
// siguiente segmento (Dashboard, /cliente, etc.).
export default function Loading() {
  return <FixeaLoader fullScreen label="Cargando" />;
}
