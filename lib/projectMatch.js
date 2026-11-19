// Reglas de coincidencia sitio <-> proyecto, compartidas por /api/projects/match
// y /api/projects/verify-key.

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isIpAddress(host) {
  return (
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    host.includes(":")
  );
}

// Todas las variantes de loopback apuntan a la misma máquina de desarrollo.
// Un proyecto guardado como "http://localhost:3000" también debe activarse en
// "http://localhost:5173" o "http://127.0.0.1:3000": el puerto de Vite cambia
// entre corridas y no queremos exigir un dominio público para probar.
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLoopbackHost(host) {
  const value = typeof host === "string" ? host.toLowerCase() : "";
  if (!value) return false;
  return LOOPBACK_HOSTS.has(value) || value.endsWith(".localhost");
}

// Para aceptar subdominios, el proyecto guardado como "example.com" también
// debe matchear "app.example.com". Buscamos por cada sufijo del host actual y
// luego validamos la coincidencia exacta en JS.
export function hostSuffixes(host) {
  if (isIpAddress(host)) return [host];

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1) return [host];

  const suffixes = [];
  // Excluye el TLD suelto ("com"): sólo hosts con al menos dos etiquetas.
  for (let index = 0; index < parts.length - 1; index += 1) {
    suffixes.push(parts.slice(index).join("."));
  }

  return suffixes.length > 0 ? suffixes : [host];
}

// El match es por origen/host: el path del targetUrl se ignora a propósito.
// Un proyecto guardado como "https://sitio.com/login" debe matchear cualquier
// ruta del sitio ("/", "/login", "/dashboard", etc.), porque la demo necesita
// inyectar el toolbar en toda la web registrada.
export function hostMatchesTarget(target, current) {
  const targetHost = target.hostname.toLowerCase();
  const currentHost = current.hostname.toLowerCase();

  if (!targetHost || !currentHost) return false;

  // Desarrollo local: cualquier loopback (localhost / 127.0.0.1 / ::1) con
  // cualquier puerto es considerado el mismo sitio.
  if (isLoopbackHost(targetHost) && isLoopbackHost(currentHost)) return true;

  const targetPort = target.port;
  const currentPort = current.port;
  const targetUsesDefaultPort =
    !targetPort || targetPort === (target.protocol === "https:" ? "443" : "80");
  const currentUsesDefaultPort =
    !currentPort || currentPort === (current.protocol === "https:" ? "443" : "80");

  if (
    targetHost === currentHost &&
    (targetPort === currentPort ||
      (targetUsesDefaultPort && currentUsesDefaultPort))
  ) {
    return true;
  }

  return (
    targetUsesDefaultPort &&
    currentUsesDefaultPort &&
    currentHost.endsWith(`.${targetHost}`)
  );
}

export function projectMatchesOrigin(targetUrl, current) {
  if (typeof targetUrl !== "string" || !targetUrl.trim()) return false;

  let target;
  try {
    target = new URL(targetUrl);
  } catch (error) {
    return false;
  }

  if (!/^https?:$/.test(target.protocol)) return false;

  return hostMatchesTarget(target, current);
}
