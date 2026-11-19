const DEFAULT_API_BASE = __FIXEA_API_BASE__;
const REQUEST_TIMEOUT_MS = 8000;
const PROBE_TIMEOUT_MS = 4000;
const MATCH_TIMEOUT_MS = 6000;
const MATCH_TIMEOUT_DEV_MS = 15000;
const MATCH_RETRY_DELAY_MS = 800;
const MATCH_CACHE_KEY = "fixea_match_cache";
const MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
const MATCH_NEGATIVE_CACHE_TTL_MS = 60 * 1000;
const MATCH_CACHE_LIMIT = 100;
const OFFLINE_MESSAGE =
  "Servidor de Fixea desconectado. Revisá tu conexión e intentá de nuevo.";
const LOOPBACK_RE =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

const ENVIRONMENT_STORAGE_KEYS = [
  "fixea_project_id",
  "fixea_project",
  "fixea_project_target_url",
  "fixea_projects",
  "fixea_dashboard_origin",
  "fixea_project_keys",
];

const CONTENT_REFRESH_ACTION = "fixea_refresh_environment";

const DASHBOARD_DEV_URL_RE =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):3000(?:[/?#]|$)/i;

function isDashboardUrl(url) {
  const value = typeof url === "string" ? url : "";
  if (!value) return false;
  if (DASHBOARD_DEV_URL_RE.test(value)) return true;
  try {
    return new URL(value).origin === new URL(DEFAULT_API_BASE).origin;
  } catch {
    return false;
  }
}
let environmentBroadcastTimer = null;

function requestTabEnvironmentRefresh(tabId) {
  if (!tabId) return;

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url) return;
    if (!/^https?:/i.test(tab.url)) return;
    if (DASHBOARD_DEV_URL_RE.test(tab.url)) return;

    chrome.tabs.sendMessage(
      tabId,
      { action: CONTENT_REFRESH_ACTION },
      () => {
        void chrome.runtime.lastError;
      },
    );
  });
}

function notifyOpenTabsEnvironmentChanged() {
  try {
    chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
      if (chrome.runtime.lastError) return;

      (tabs || []).forEach((tab) => {
        if (!tab?.id) return;
        if (DASHBOARD_DEV_URL_RE.test(tab.url || "")) return;
        chrome.tabs.sendMessage(
          tab.id,
          { action: CONTENT_REFRESH_ACTION },
          () => {
            void chrome.runtime.lastError;
          },
        );
      });
    });
  } catch (error) {
    console.warn("Fixea: no se pudo avisar a las pestañas abiertas", error);
  }
}

function scheduleEnvironmentBroadcast() {
  if (environmentBroadcastTimer) clearTimeout(environmentBroadcastTimer);

  environmentBroadcastTimer = setTimeout(() => {
    environmentBroadcastTimer = null;
    notifyOpenTabsEnvironmentChanged();
  }, 50);
}

try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!ENVIRONMENT_STORAGE_KEYS.some((key) => key in changes)) return;

    chrome.storage.local.remove(MATCH_CACHE_KEY);
    scheduleEnvironmentBroadcast();
  });
} catch (error) {
  console.warn("Fixea: no se pudo observar los cambios de entorno", error);
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  requestTabEnvironmentRefresh(tabId);
});

function isLoopbackBase(value) {
  return LOOPBACK_RE.test(typeof value === "string" ? value.trim() : "");
}

function normalizeApiBase(value) {
  const raw = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  return raw || DEFAULT_API_BASE;
}

function resolveApiBase(storedBase) {
  const raw = normalizeApiBase(storedBase);
  return isLoopbackBase(raw) === isLoopbackBase(DEFAULT_API_BASE)
    ? raw
    : DEFAULT_API_BASE;
}

function getApiBase() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["fixea_api_base"], (result) => {
        if (chrome.runtime.lastError) {
          resolve(DEFAULT_API_BASE);
          return;
        }
        resolve(resolveApiBase(result && result.fixea_api_base));
      });
    } catch (error) {
      console.warn("Fixea: no se pudo leer fixea_api_base", error);
      resolve(DEFAULT_API_BASE);
    }
  });
}

function isOfflineError(error) {
  return (
    error instanceof TypeError ||
    error?.name === "AbortError" ||
    /failed to fetch|networkerror|network error|load failed|aborted/i.test(
      error?.message || ""
    )
  );
}

function offlineResponse() {
  return { ok: false, status: 0, offline: true, error: OFFLINE_MESSAGE };
}

async function fetchWithTimeout(endpoint, options = {}, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs || REQUEST_TIMEOUT_MS
  );

  try {
    return await fetch(endpoint, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onStartup?.addListener(() => {
  syncProjectKeysFromServer({ force: true });
});

chrome.runtime.onInstalled.addListener(() => {
  syncProjectKeysFromServer({ force: true });
  console.log("Fixea Extension instalada correctamente.");

  chrome.storage.local.get(["fixea_tickets", "fixea_api_base"], (result) => {
    if (!result.fixea_tickets) {
      chrome.storage.local.set({ fixea_tickets: [] });
    }

    const stored = result.fixea_api_base;
    if (
      typeof stored === "string" &&
      stored.trim() &&
      isLoopbackBase(stored) !== isLoopbackBase(DEFAULT_API_BASE)
    ) {
      chrome.storage.local.remove("fixea_api_base");
    }
  });
});

function captureVisibleTab(windowId) {
  return new Promise((resolve) => {
    if (!chrome.tabs?.captureVisibleTab) {
      resolve(null);
      return;
    }

    const options = { format: "jpeg", quality: 60 };

    const done = (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.warn(
          "Fixea: no se pudo capturar la pantalla",
          chrome.runtime.lastError.message
        );
        resolve(null);
        return;
      }

      resolve(
        typeof dataUrl === "string" && dataUrl.startsWith("data:image/")
          ? dataUrl
          : null
      );
    };

    try {
      if (typeof windowId === "number") {
        chrome.tabs.captureVisibleTab(windowId, options, done);
      } else {
        chrome.tabs.captureVisibleTab(options, done);
      }
    } catch (error) {
      console.warn("Fixea: error al capturar la pestaña", error);
      resolve(null);
    }
  });
}

function getLocalSettings(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        resolve(result || {});
      });
    } catch (error) {
      console.warn("Fixea: no se pudo leer el entorno cacheado", error);
      resolve({});
    }
  });
}

function normalizeObjectId(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return /^[a-f0-9]{24}$/i.test(raw) ? raw : null;
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

async function withSessionContext(payload) {
  const base = payload && typeof payload === "object" ? { ...payload } : {};
  const settings = await getLocalSettings([
    "fixea_session",
    "fixea_project_id",
    "fixea_project",
    "fixea_author",
    "fixea_created_by",
    "fixea_role",
    "fixea_is_developer",
  ]);
  const session = settings.fixea_session || {};

  const projectId = normalizeObjectId(
    base.projectId || settings.fixea_project_id || session.projectId
  );
  const createdBy = normalizeObjectId(
    base.createdBy || base.userId || settings.fixea_created_by || session.userId
  );
  const project = (
    base.project ||
    settings.fixea_project ||
    session.projectName ||
    ""
  ).trim();
  const author = (
    base.author ||
    settings.fixea_author ||
    session.author ||
    ""
  ).trim();
  const role = normalizeRole(
    base.role || settings.fixea_role || session.role
  );

  const next = { ...base };
  if (projectId) next.projectId = projectId;
  else delete next.projectId;
  if (createdBy) {
    next.createdBy = createdBy;
    next.userId = createdBy;
  } else {
    delete next.createdBy;
    delete next.userId;
  }
  if (project) next.project = project;
  if (author) next.author = author;
  if (role) next.role = role;

  return next;
}

// ---- Keys de proyecto ----
const PROJECT_KEYS_STORAGE = "fixea_project_keys";
const PROJECT_KEY_HEADER = "X-Fixea-Project-Key";

async function readProjectKeys() {
  const settings = await getLocalSettings([PROJECT_KEYS_STORAGE]);
  const value = settings?.[PROJECT_KEYS_STORAGE];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

async function getProjectKey(projectId) {
  const id = normalizeObjectId(projectId);
  if (!id) return "";
  const keys = await readProjectKeys();
  return typeof keys[id] === "string" ? keys[id] : "";
}

async function writeProjectKey(projectId, key) {
  const id = normalizeObjectId(projectId);
  if (!id) return;
  const keys = await readProjectKeys();
  if (key) keys[id] = key;
  else delete keys[id];
  await chrome.storage.local.set({ [PROJECT_KEYS_STORAGE]: keys });
}

const KEY_SYNC_MIN_GAP_MS = 30000;
const PROJECT_URL_MAP_STORAGE = "fixea_project_url_map";

function projectOriginOf(targetUrl) {
  const raw = typeof targetUrl === "string" ? targetUrl.trim() : "";
  if (!raw) return "";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin;
  } catch {
    return "";
  }
}
let lastKeySyncAt = 0;
let keySyncInFlight = null;

async function syncProjectKeysFromServer({ force = false } = {}) {
  if (keySyncInFlight) return keySyncInFlight;
  if (!force && Date.now() - lastKeySyncAt < KEY_SYNC_MIN_GAP_MS) return false;
  lastKeySyncAt = Date.now();

  keySyncInFlight = (async () => {
    try {
      const apiBase = await getApiBase();
      const res = await fetchWithTimeout(`${apiBase}/api/projects`, {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      const projects = Array.isArray(data?.projects) ? data.projects : [];
      const keys = await readProjectKeys();
      const stored = await getLocalSettings([PROJECT_URL_MAP_STORAGE]);
      const previousMap = JSON.stringify(stored?.[PROJECT_URL_MAP_STORAGE] || {});
      const urlMap = {};
      let changed = false;

      for (const project of projects) {
        const id = normalizeObjectId(project?.id);
        const key =
          typeof project?.accessKey === "string" ? project.accessKey.trim() : "";
        if (id && key && keys[id] !== key) {
          keys[id] = key;
          changed = true;
        }

        const origin = projectOriginOf(project?.targetUrl);
        if (id && origin) {
          urlMap[origin] = {
            id,
            name: typeof project?.name === "string" ? project.name : "",
            targetUrl: project.targetUrl,
          };
        }
      }

      if (changed) {
        await chrome.storage.local.set({ [PROJECT_KEYS_STORAGE]: keys });
      }
      if (JSON.stringify(urlMap) !== previousMap) {
        await chrome.storage.local.set({ [PROJECT_URL_MAP_STORAGE]: urlMap });
      }
      return changed;
    } catch {
      return false;
    } finally {
      keySyncInFlight = null;
    }
  })();

  return keySyncInFlight;
}

async function keyHeaders(projectId) {
  let key = await getProjectKey(projectId);
  if (!key && normalizeObjectId(projectId)) {
    await syncProjectKeysFromServer();
    key = await getProjectKey(projectId);
  }
  return key ? { [PROJECT_KEY_HEADER]: key } : {};
}

async function forgetKeyIfRejected(projectId, status) {
  if (status !== 401 && status !== 403) return false;
  if (!(await getProjectKey(projectId))) return status === 401;
  await writeProjectKey(projectId, "");
  return true;
}

async function verifyProjectKey(projectId, key, origin) {
  const apiBase = await getApiBase();
  const endpoint = `${apiBase}/api/projects/verify-key`;

  let res;
  try {
    res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ projectId, key, origin }),
    });
  } catch (error) {
    if (isOfflineError(error)) return offlineResponse();
    return { ok: false, status: 0, error: error?.message || "Error de red" };
  }

  const data = await res.json().catch(() => null);

  if (res.ok && data?.success && data.key) {
    await writeProjectKey(data.project?.id || projectId, data.key);
    chrome.storage.local.remove(MATCH_CACHE_KEY);
    return { ok: true, status: res.status, project: data.project };
  }

  return {
    ok: false,
    status: res.status,
    error: data?.error || `El servidor respondió ${res.status}.`,
  };
}

async function createTicket(payload) {
  const apiBase = await getApiBase();
  const endpoint = `${apiBase}/api/tickets`;
  const body = await withSessionContext(payload);

  let res;

  try {
    res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(await keyHeaders(body?.projectId)),
      },
      body: JSON.stringify(body || {}),
    });
  } catch (error) {
    console.warn(
      `Fixea: no se pudo conectar con ${endpoint}. ` +
        "Verificá la conexión y que el servidor esté accesible.",
      error
    );

    if (isOfflineError(error)) return offlineResponse();

    return {
      ok: false,
      status: 0,
      offline: false,
      error: error?.message || "Error de red al enviar el ticket.",
    };
  }

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  if (!res.ok) {
    console.warn(
      `Fixea: ${endpoint} respondió ${res.status}. Body:`,
      data
    );
  } else {
    console.log(`Fixea: ticket enviado a ${endpoint} (${res.status})`);
    notifyDashboardTicketsChanged();
  }

  const needsKey = res.ok
    ? false
    : await forgetKeyIfRejected(body?.projectId, res.status);

  return {
    ok: res.ok,
    status: res.status,
    offline: false,
    needsKey,
    data,
    error: res.ok ? null : data?.error || `El servidor respondió ${res.status}.`,
  };
}

async function notifyDashboardTicketsChanged() {
  try {
    const apiBase = await getApiBase();
    const patterns = new Set([`${DEFAULT_API_BASE}/*`]);

    try {
      patterns.add(`${new URL(apiBase).origin}/*`);
    } catch (error) {
    }

    chrome.tabs.query({ url: Array.from(patterns) }, (tabs) => {
      (tabs || []).forEach((tab) => {
        if (!tab?.id) return;
        if (DASHBOARD_DEV_URL_RE.test(tab.url || "")) return;
        chrome.tabs.sendMessage(
          tab.id,
          { action: "fixea_tickets_changed" },
          () => {
            void chrome.runtime.lastError;
          }
        );
      });
    });
  } catch (error) {
    console.warn("Fixea: no se pudo avisar al Dashboard", error);
  }
}

async function listTickets(projectId) {
  const apiBase = await getApiBase();
  const id = typeof projectId === "string" ? projectId.trim() : "";

  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return {
      ok: true,
      status: 200,
      offline: false,
      data: { success: true, tickets: [] },
    };
  }

  const endpoint = `${apiBase}/api/tickets?compact=1&projectId=${encodeURIComponent(id)}`;

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "GET",
      headers: { Accept: "application/json", ...(await keyHeaders(id)) },
      cache: "no-store",
      credentials: "include",
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    const needsKey = res.ok ? false : await forgetKeyIfRejected(id, res.status);

    return { ok: res.ok, status: res.status, offline: false, needsKey, data };
  } catch (error) {
    console.warn(`Fixea: no se pudo leer ${endpoint}`, error);
    if (isOfflineError(error)) return offlineResponse();

    return {
      ok: false,
      status: 0,
      offline: false,
      error: error?.message || "Error de red al listar los tickets.",
    };
  }
}

const UPDATABLE_STATUSES = ["PENDIENTE", "EN_PROCESO", "FINALIZADO"];

async function updateTicketStatus(remoteId, status, projectId, preferredName) {
  const apiBase = await getApiBase();
  const id = typeof remoteId === "string" ? remoteId.trim() : "";
  const nextStatus =
    typeof status === "string" ? status.trim().toUpperCase() : "";

  if (!id || !UPDATABLE_STATUSES.includes(nextStatus)) {
    return {
      ok: false,
      status: 0,
      error: "Falta el id del ticket o el estado es inválido",
    };
  }

  const endpoint = `${apiBase}/api/tickets/${encodeURIComponent(id)}`;

  let verifiedByName =
    typeof preferredName === "string" ? preferredName.trim().slice(0, 120) : "";
  if (!verifiedByName) {
    try {
      const stored = await chrome.storage.local.get(["fixea_author"]);
      verifiedByName =
        typeof stored?.fixea_author === "string"
          ? stored.fixea_author.trim().slice(0, 120)
          : "";
    } catch {
      verifiedByName = "";
    }
  }

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(await keyHeaders(projectId)),
      },
      body: JSON.stringify({
        status: nextStatus,
        ...(nextStatus === "FINALIZADO" && verifiedByName
          ? { verifiedByName }
          : {}),
      }),
      credentials: "include",
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (res.ok) {
      notifyDashboardTicketsChanged();
    } else {
      console.warn(
        `Fixea: PATCH ${endpoint} respondió ${res.status}. Body:`,
        data
      );
    }

    return {
      ok: res.ok,
      status: res.status,
      offline: false,
      data,
      error: res.ok ? null : data?.error || "No se pudo actualizar el ticket",
    };
  } catch (error) {
    console.warn(`Fixea: no se pudo conectar con ${endpoint}`, error);
    if (isOfflineError(error)) return offlineResponse();

    return {
      ok: false,
      status: 0,
      offline: false,
      error: error?.message || "Error de red al actualizar el ticket.",
    };
  }
}

async function deleteTicket(remoteId, projectId, pageUrl) {
  const apiBase = await getApiBase();
  const id = typeof remoteId === "string" ? remoteId.trim() : "";

  if (!id) {
    return { ok: false, status: 0, error: "Falta el id remoto del ticket" };
  }

  const query =
    typeof pageUrl === "string" && pageUrl
      ? `?pageUrl=${encodeURIComponent(pageUrl)}`
      : "";
  const endpoint = `${apiBase}/api/tickets/${encodeURIComponent(id)}${query}`;

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "DELETE",
      headers: { Accept: "application/json", ...(await keyHeaders(projectId)) },
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    const ok = res.ok || res.status === 404;

    if (ok) {
      console.log(`Fixea: ticket ${id} eliminado de ${apiBase} (${res.status})`);
      notifyDashboardTicketsChanged();
    } else {
      console.warn(
        `Fixea: DELETE ${endpoint} respondió ${res.status}. Body:`,
        data
      );
    }

    return {
      ok,
      status: res.status,
      offline: false,
      data,
      error: ok ? null : data?.error || "No se pudo borrar el ticket",
    };
  } catch (error) {
    console.warn(`Fixea: no se pudo conectar con ${endpoint}`, error);
    if (isOfflineError(error)) return offlineResponse();

    return {
      ok: false,
      status: 0,
      offline: false,
      error: error?.message || "Error de red al borrar el ticket.",
    };
  }
}

async function probeServer(candidateBase) {
  const apiBase =
    typeof candidateBase === "string" && candidateBase.trim()
      ? resolveApiBase(candidateBase)
      : await getApiBase();

  try {
    const res = await fetchWithTimeout(
      `${apiBase}/api/auth/me`,
      {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
      PROBE_TIMEOUT_MS
    );

    return { ok: true, online: true, status: res.status, apiBase };
  } catch (error) {
    console.warn(`Fixea: no se pudo alcanzar ${apiBase}`, error);
    return { ...offlineResponse(), online: false, apiBase };
  }
}

function pruneMatchCache(cache) {
  const entries = Object.entries(cache)
    .filter(([, entry]) => entry && typeof entry.ts === "number")
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, MATCH_CACHE_LIMIT);

  return Object.fromEntries(entries);
}

function readMatchCache() {
  return getLocalSettings([MATCH_CACHE_KEY]).then((settings) => {
    const raw = settings?.[MATCH_CACHE_KEY];
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  });
}

function buildMatchKey(rawUrl) {
  const raw = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return "";
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) {
      return "http://localhost";
    }
    return url.origin;
  } catch (error) {
    return "";
  }
}

async function matchProject(rawUrl) {
  const result = await matchProjectRaw(rawUrl);
  let keys = await readProjectKeys();
  const projectId = normalizeObjectId(result?.project?.id);
  if (projectId && !keys[projectId]) {
    await syncProjectKeysFromServer();
    keys = await readProjectKeys();
  }
  return {
    ...result,
    keyLinked: Boolean(projectId && keys[projectId]),
    linkedProjectIds: Object.keys(keys),
  };
}

async function matchProjectRaw(rawUrl) {
  const requestUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
  const key = buildMatchKey(requestUrl);

  if (!key) {
    return {
      ok: false,
      status: 0,
      offline: false,
      match: null,
      error: "URL inválida",
    };
  }

  const cache = await readMatchCache();
  const cached = cache[key];

  const cacheTtl =
    cached?.match === true
      ? MATCH_CACHE_TTL_MS
      : MATCH_NEGATIVE_CACHE_TTL_MS;

  if (cached && Date.now() - cached.ts < cacheTtl) {
    return {
      ok: true,
      status: 200,
      offline: false,
      match: cached.match === true,
      project: cached.project || null,
      cached: true,
    };
  }

  const apiBase = await getApiBase();
  const linkedIds = Object.keys(await readProjectKeys()).slice(0, 50);
  const endpoint =
    `${apiBase}/api/projects/match?origin=${encodeURIComponent(key)}` +
    (linkedIds.length ? `&linked=${linkedIds.join(",")}` : "");
  const timeoutMs = isLoopbackBase(apiBase)
    ? MATCH_TIMEOUT_DEV_MS
    : MATCH_TIMEOUT_MS;
  let res;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      res = await fetchWithTimeout(
        endpoint,
        {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
        timeoutMs
      );
      break;
    } catch (error) {
      console.warn(
        `Fixea: match ${key} falló (intento ${attempt}/2) contra ${apiBase}`,
        error?.name === "AbortError" ? `timeout ${timeoutMs} ms` : error
      );

      if (attempt === 2) {
        return {
          ok: false,
          status: 0,
          offline: true,
          match: null,
          apiBase,
          error: OFFLINE_MESSAGE,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, MATCH_RETRY_DELAY_MS));
    }
  }

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      offline: false,
      match: null,
      error: data?.error || `El servidor respondió ${res.status}.`,
    };
  }

  const result = {
    ok: true,
    status: res.status,
    offline: false,
    match: data?.match === true,
    project: data?.project || null,
  };

  console.info(
    `Fixea: match ${key} → ${result.match ? `proyecto "${result.project?.name}"` : "sin proyecto registrado"}`
  );

  cache[key] = {
    ts: Date.now(),
    match: result.match,
    project: result.project,
  };

  try {
    chrome.storage.local.set({
      [MATCH_CACHE_KEY]: pruneMatchCache(cache),
    });
  } catch (error) {
    console.warn("Fixea: no se pudo guardar el cache de matches", error);
  }

  return result;
}

function sendShowCard(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "fixea_show_card" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ delivered: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve({ delivered: true, response });
    });
  });
}

async function injectContentScript(tabId) {
  if (!chrome.scripting?.executeScript) return false;

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["content.css"],
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return true;
  } catch (error) {
    console.warn("Fixea: no se pudo inyectar el content script", error);
    return false;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  if (isDashboardUrl(tab.url)) return;

  const first = await sendShowCard(tab.id);
  if (first.delivered) return;

  if (/^https?:/i.test(tab.url || "") && (await injectContentScript(tab.id))) {
    console.info("Fixea: content script inyectado por clic en", tab.url);
    const second = await sendShowCard(tab.id);
    if (second.delivered) return;
  }

  getApiBase()
    .then((apiBase) => chrome.tabs.create({ url: `${apiBase}/` }))
    .catch(() => {});
});

const API_PROXY_ROUTES = [
  /^\/api\/projects\/match(?:\?|$)/,
  /^\/api\/tickets(?:\?|$)/,
  /^\/api\/tickets\/[A-Za-z0-9_-]{1,64}(?:\?|$)/,
];
const API_PROXY_METHODS = ["GET", "POST", "PATCH", "DELETE"];

async function proxyApiRequest(request) {
  const path = typeof request?.path === "string" ? request.path.trim() : "";
  const method = String(request?.method || "GET").toUpperCase();

  if (!API_PROXY_ROUTES.some((route) => route.test(path))) {
    return { ok: false, status: 0, data: null, error: "Ruta no permitida" };
  }
  if (!API_PROXY_METHODS.includes(method)) {
    return { ok: false, status: 0, data: null, error: "Método no permitido" };
  }

  const apiBase = await getApiBase();
  const headers = {
    Accept: "application/json",
    ...(request.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(await keyHeaders(request.projectId)),
  };

  let res;
  try {
    res = await fetchWithTimeout(`${apiBase}${path}`, {
      method,
      headers,
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      credentials: "include",
    });
  } catch (error) {
    if (isOfflineError(error)) return { ...offlineResponse(), data: null };
    return { ok: false, status: 0, data: null, error: error?.message || "Error de red" };
  }

  const data = await res.json().catch(() => null);
  if (res.ok && method !== "GET" && /^\/api\/tickets/.test(path)) {
    notifyDashboardTicketsChanged();
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    error: res.ok ? null : data?.error || `El servidor respondió ${res.status}.`,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "FIXEA_API_REQUEST") {
    if (sender?.id !== chrome.runtime.id) return false;

    proxyApiRequest(message)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({
          ok: false,
          status: 0,
          data: null,
          error: error?.message || "Error en el proxy de la API",
        })
      );
    return true;
  }

  if (message?.action === "get_status") {
    sendResponse({ status: "ok" });
    return false;
  }

  if (message?.action === "probe_server") {
    probeServer(message.apiBase)
      .then((response) => sendResponse(response))
      .catch(() =>
        sendResponse({
          ok: false,
          online: false,
          status: 0,
          offline: true,
          error: OFFLINE_MESSAGE,
        })
      );
    return true;
  }

  if (message?.action === "match_project") {
    matchProject(message.url || message.origin)
      .then((response) => sendResponse(response))
      .catch((error) => {
        console.error("Fixea: error al verificar el proyecto", error);
        sendResponse({
          ok: false,
          status: 0,
          offline: false,
          match: null,
          error: "Error al verificar el proyecto",
        });
      });
    return true;
  }

  if (message?.action === "verify_project_key") {
    verifyProjectKey(message.projectId, message.key, message.origin)
      .then((response) => sendResponse(response))
      .catch((error) =>
        sendResponse({
          ok: false,
          status: 0,
          error: error?.message || "Error al verificar la Key",
        })
      );
    return true;
  }

  if (message?.action === "delete_ticket") {
    deleteTicket(message.remoteId, message.projectId, message.pageUrl)
      .then((response) => sendResponse(response))
      .catch((error) => {
        console.error("Fixea: error al borrar el ticket", error);
        sendResponse({
          ok: false,
          status: 0,
          error: error?.message || "Error al borrar el ticket",
        });
      });
    return true;
  }

  if (message?.action === "list_tickets") {
    listTickets(message.projectId)
      .then((response) => sendResponse(response))
      .catch((error) => {
        console.error("Fixea: error al listar los tickets", error);
        sendResponse({
          ok: false,
          status: 0,
          error: error?.message || "Error al listar los tickets",
        });
      });
    return true;
  }

  if (message?.action === "update_ticket_status") {
    updateTicketStatus(
      message.remoteId,
      message.status,
      message.projectId,
      message.verifiedByName,
    )
      .then((response) => sendResponse(response))
      .catch((error) => {
        console.error("Fixea: error al actualizar el ticket", error);
        sendResponse({
          ok: false,
          status: 0,
          error: error?.message || "Error al actualizar el ticket",
        });
      });
    return true;
  }

  if (message?.action === "capture_screenshot") {
    captureVisibleTab(sender?.tab?.windowId)
      .then((screenshotUrl) =>
        sendResponse({ ok: !!screenshotUrl, screenshotUrl })
      )
      .catch(() => sendResponse({ ok: false, screenshotUrl: null }));
    return true;
  }

  if (message?.action === "create_ticket") {
    createTicket(message.payload)
      .then((response) => sendResponse(response))
      .catch((error) => {
        console.error("Fixea: error de red al crear el ticket", error);
        sendResponse({
          ok: false,
          status: 0,
          error: error?.message || "Error de red al enviar el ticket",
        });
      });
    return true;
  }

  return false;
});
