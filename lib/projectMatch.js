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
