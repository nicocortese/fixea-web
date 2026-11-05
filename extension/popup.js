const toggleBtn = document.getElementById("toggle-btn");
const statusEl = document.getElementById("status");
const envEl = document.getElementById("env");
const envProjectEl = document.getElementById("env-project");
const envUserEl = document.getElementById("env-user");
const envRoleBadgeEl = document.getElementById("env-role-badge");
const envRoleEl = document.getElementById("env-role");
const connectCard = document.getElementById("connect-card");
const openDashboardBtn = document.getElementById("open-dashboard-btn");
const annotateControls = document.getElementById("annotate-controls");
const footerEl = document.getElementById("footer");
const offlineBanner = document.getElementById("offline-banner");
const retryConnectionBtn = document.getElementById("retry-connection");

// Inyectada por Vite en build-time desde VITE_FIXEA_API_BASE (.env).
const DASHBOARD_ORIGIN = __FIXEA_API_BASE__;
const PROBE_TIMEOUT_MS = 4000;
const LOOPBACK_RE =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

let dashboardBase = DASHBOARD_ORIGIN;
let connected = false;
let dashboardTabActive = false;
let serverOnline = null;

function isLoopbackBase(value) {
  return LOOPBACK_RE.test(typeof value === "string" ? value.trim() : "");
}

// Un build de producción no debe usar un localhost cacheado por un build de
// desarrollo (y viceversa).
function normalizeBase(value) {
  const raw =
    typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  if (!raw) return DASHBOARD_ORIGIN;

  return isLoopbackBase(raw) === isLoopbackBase(DASHBOARD_ORIGIN)
    ? raw
    : DASHBOARD_ORIGIN;
}

// El match es por host/origen: el path del targetUrl se ignora.
function hostMatchesTarget(targetUrl, tabUrl) {
  if (!targetUrl || !tabUrl) return false;

  try {
    const target = new URL(targetUrl);
    const current = new URL(tabUrl);
    const targetHostname = target.hostname.toLowerCase();
    const currentHostname = current.hostname.toLowerCase();
    const targetUsesDefaultPort =
      !target.port ||
      target.port === (target.protocol === "https:" ? "443" : "80");
    const currentUsesDefaultPort =
      !current.port ||
      current.port === (current.protocol === "https:" ? "443" : "80");

    if (
      targetHostname === currentHostname &&
      (target.port === current.port ||
        (targetUsesDefaultPort && currentUsesDefaultPort))
    ) {
      return true;
    }

    return (
      targetUsesDefaultPort &&
      currentUsesDefaultPort &&
      currentHostname.endsWith(`.${targetHostname}`)
    );
  } catch (error) {
    return false;
  }
}

function storedEnvironmentMatchesTab(stored, tabUrl) {
  if (!tabUrl) return false;
  if (hostMatchesTarget(stored.fixea_project_target_url, tabUrl)) return true;

  try {
    const projects = JSON.parse(stored.fixea_projects || "[]");
    return (
      Array.isArray(projects) &&
      projects.some((project) => hostMatchesTarget(project?.targetUrl, tabUrl))
    );
  } catch (error) {
    return false;
  }
}

function openDashboard() {
  const url = `${dashboardBase}/`;

  try {
    chrome.tabs.create({ url });
  } catch (error) {
    window.open(url, "_blank", "noopener");
  }

  window.close();
}

function setStatus(text, tone = "idle") {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

// Cualquier respuesta HTTP (incluso 401) implica que el servidor está vivo.
// Sólo un error de red o el timeout se consideran "desconectado".
async function probeServer(apiBase) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    await fetch(`${apiBase}/api/auth/me`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    return true;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function renderServerState(online) {
  const wasOnline = serverOnline;
  serverOnline = online;

  if (offlineBanner) offlineBanner.hidden = online !== false;

  if (online === false) {
    setStatus("Servidor de Fixea desconectado", "error");
    if (connectCard) connectCard.hidden = true;
    return;
  }

  if (connectCard) {
    connectCard.hidden = connected || dashboardTabActive;
  }

  if (wasOnline === false) {
    setStatus(connected ? "Listo para anotar" : "Servidor de Fixea disponible");
  }
}

async function retryConnection() {
  if (retryConnectionBtn) {
    retryConnectionBtn.disabled = true;
    retryConnectionBtn.textContent = "Reintentando…";
  }

  try {
    const online = await probeServer(dashboardBase);
    renderServerState(online);

    if (online) {
      await loadEnvironment();
      setStatus(connected ? "Listo para anotar" : "Servidor de Fixea disponible");
    }
  } catch (error) {
    renderServerState(false);
  } finally {
    if (retryConnectionBtn) {
      retryConnectionBtn.disabled = false;
      retryConnectionBtn.textContent = "Reintentar";
    }
  }
}

function resetButton() {
  toggleBtn.disabled = false;
  toggleBtn.textContent = "Nueva observación";
}

// Pestañas donde content.js nunca se inyecta. En esos casos no hay entorno
// disponible y el popup muestra la card de conexión.
function isRestrictedTab(tab) {
  const url = typeof tab?.url === "string" ? tab.url.trim() : "";
  if (!url) return true;

  if (/^(chrome|edge|about|chrome-extension|devtools|opera|brave):/i.test(url)) {
    return true;
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.toLowerCase().includes("newtab")) return true;

    if (
      (parsed.hostname === "www.google.com" || parsed.hostname === "google.com") &&
      (parsed.pathname === "" || parsed.pathname === "/") &&
      !parsed.search
    ) {
      return true;
    }
  } catch (error) {
    return true;
  }

  return false;
}

function readStorage(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(result || {});
      });
    } catch (error) {
      resolve({});
    }
  });
}

function writeStorage(values) {
  try {
    chrome.storage.local.set(values);
  } catch (error) {
    // Sin storage la sesión sigue mostrándose, sólo no queda cacheada.
  }
}

function getActiveTab() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        resolve(tab || null);
      });
    } catch (error) {
      resolve(null);
    }
  });
}

// El content script corriendo en localhost:3000 resuelve proyecto + sesión y,
// si corresponde, los deja cacheados en chrome.storage.
function askActiveTabEnv(tab) {
  return new Promise((resolve) => {
    if (!tab?.id || isRestrictedTab(tab)) {
      resolve(null);
      return;
    }

    try {
      chrome.tabs.sendMessage(tab.id, { action: "fixea_get_env" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response?.ok ? response.env : null);
      });
    } catch (error) {
      resolve(null);
    }
  });
}

async function resolveProjectName(projectId, projectName, apiBase) {
  if (!projectId || projectName) return projectName || "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(`${apiBase}/api/projects`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    const list = Array.isArray(data?.projects) ? data.projects : [];
    const match = list.find(
      (item) => String(item.id ?? item._id) === String(projectId)
    );
    return match?.name || "";
  } catch (error) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRole(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return "";
  if (["developer", "admin", "programador", "dev"].includes(raw)) {
    return "developer";
  }
  if (raw === "client" || raw === "cliente") return "client";
  return raw;
}

function renderEnvironment({ projectId, projectName, author, role }) {
  const showProject = !!(projectName || projectId);
  const showUser = !!author;
  const normalizedRole = normalizeRole(role);
  const isDeveloper = normalizedRole === "developer";

  if (!showProject && !showUser && !isDeveloper) {
    envEl.hidden = true;
    return;
  }

  envEl.hidden = false;
  envProjectEl.textContent = projectName || "Sin nombre";
  envUserEl.textContent = author || "Invitado";
  envProjectEl.title = projectId || projectName || "";

  if (envRoleBadgeEl) {
    envRoleBadgeEl.hidden = !isDeveloper;
  }
  if (envRoleEl) {
    envRoleEl.textContent = isDeveloper ? "Programador" : "";
  }
}

function renderConnectState(isConnected, isDashboardTab = false) {
  connected = isConnected;
  dashboardTabActive = isDashboardTab;

  if (connectCard) {
    connectCard.hidden = isConnected || isDashboardTab;
  }

  if (annotateControls) {
    annotateControls.hidden = !isConnected || isDashboardTab;
  }

  if (!isConnected && !isDashboardTab && envEl) {
    envEl.hidden = true;
  }
}

async function loadEnvironment() {
  const [tab, stored] = await Promise.all([
    getActiveTab(),
    readStorage([
      "fixea_session",
      "fixea_project",
      "fixea_project_id",
      "fixea_project_target_url",
      "fixea_projects",
      "fixea_author",
      "fixea_created_by",
      "fixea_role",
      "fixea_is_developer",
      "fixea_api_base",
    ]),
  ]);

  const fromTab = await askActiveTabEnv(tab);
  const cached = stored.fixea_session || {};
  const apiBase = normalizeBase(stored.fixea_api_base);
  dashboardBase = apiBase;
  const probePromise = probeServer(apiBase);
  const tabKnowsEnv = Boolean(fromTab);

  if (footerEl) {
    footerEl.textContent = `${apiBase.replace(/^https?:\/\//i, "")} · Fixea`;
  }

  let isDashboardTab = false;

  try {
    isDashboardTab = Boolean(tab?.url) && new URL(tab.url).origin === new URL(apiBase).origin;
  } catch (error) {
    isDashboardTab = false;
  }

  const projectId = tabKnowsEnv
    ? fromTab.projectId || ""
    : stored.fixea_project_id || cached.projectId || "";
  const author = tabKnowsEnv
    ? fromTab.author || ""
    : stored.fixea_author || cached.author || "";
  const userId = tabKnowsEnv
    ? fromTab.userId || ""
    : stored.fixea_created_by || cached.userId || "";
  const role = tabKnowsEnv
    ? fromTab.role || ""
    : stored.fixea_role || cached.role || "";
  const normalizedRole = normalizeRole(role);
  const hasSession = Boolean(userId || normalizedRole);
  const linked = tabKnowsEnv
    ? fromTab.linked === true
    : hasSession &&
      (isDashboardTab || storedEnvironmentMatchesTab(stored, tab?.url || ""));
  const isConnected = hasSession && Boolean(projectId) && linked && !isDashboardTab;

  // Mostramos el estado cacheado de inmediato: el probe no debe bloquear.
  renderConnectState(isConnected, isDashboardTab);

  const serverIsOnline = await probePromise;

  let projectName = tabKnowsEnv
    ? fromTab.projectName || ""
    : stored.fixea_project || cached.projectName || "";

  if (isConnected && projectId && !projectName && serverIsOnline) {
    projectName = await resolveProjectName(projectId, "", apiBase);
  }

  const payload = {
    fixea_session: {
      projectId: isConnected ? projectId : "",
      projectName: isConnected ? projectName : "",
      author,
      userId,
      email: fromTab?.email || cached.email || "",
      role: normalizedRole,
      syncedAt: new Date().toISOString(),
    },
  };

  if (isConnected && projectId) payload.fixea_project_id = projectId;
  if (isConnected && projectName) payload.fixea_project = projectName;
  if (author) payload.fixea_author = author;
  if (userId) payload.fixea_created_by = userId;
  if (normalizedRole) payload.fixea_role = normalizedRole;
  payload.fixea_is_developer = normalizedRole === "developer";

  writeStorage(payload);

  if (isConnected || (isDashboardTab && hasSession && projectId)) {
    renderEnvironment({ projectId, projectName, author, role: normalizedRole });
  }

  renderServerState(serverIsOnline);
}

if (openDashboardBtn) {
  openDashboardBtn.addEventListener("click", openDashboard);
}

if (retryConnectionBtn) {
  retryConnectionBtn.addEventListener("click", retryConnection);
}

if (toggleBtn) {
  toggleBtn.addEventListener("click", async () => {
    if (!connected) {
      openDashboard();
      return;
    }

    toggleBtn.disabled = true;
    toggleBtn.textContent = "Activando...";
    setStatus("Preparando el modo de anotación");

    try {
      const tab = await getActiveTab();

      if (!tab || !tab.id || isRestrictedTab(tab)) {
        setStatus("Listo para anotar");
        resetButton();
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: "toggle_pinning" }, () => {
        if (chrome.runtime.lastError) {
          setStatus("Recargá la página e intentá de nuevo", "error");
          resetButton();
          return;
        }

        window.close();
      });
    } catch (error) {
      setStatus("Listo para anotar");
      resetButton();
    }
  });
}

resetButton();
loadEnvironment().catch((error) => {
  console.warn("Fixea: no se pudo cargar el entorno del popup", error);
  setStatus("No se pudo leer el entorno", "error");
});