
export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isIpAddress(host) {
  return (
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
    host.includes(":")
  );
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLoopbackHost(host) {
  const value = typeof host === "string" ? host.toLowerCase() : "";
  if (!value) return false;
  return LOOPBACK_HOSTS.has(value) || value.endsWith(".localhost");
}

export function hostSuffixes(host) {
  if (isIpAddress(host)) return [host];

  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1) return [host];

  const suffixes = [];
  for (let index = 0; index < parts.length - 1; index += 1) {
    suffixes.push(parts.slice(index).join("."));
  }

  return suffixes.length > 0 ? suffixes : [host];
}

export function hostMatchesTarget(target, current) {
  const targetHost = target.hostname.toLowerCase();
  const currentHost = current.hostname.toLowerCase();

  if (!targetHost || !currentHost) return false;

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
