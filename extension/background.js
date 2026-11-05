// Inyectada por Vite en build-time desde VITE_FIXEA_API_BASE (.env).
const DEFAULT_API_BASE = __FIXEA_API_BASE__;
const REQUEST_TIMEOUT_MS = 8000;
const PROBE_TIMEOUT_MS = 4000;
// En `next dev` la primera llamada compila la ruta y abre la conexión a
// Mongo Atlas: 4 s no alcanzaban y el match se reportaba como "offline".
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

// Cuando el dashboard crea/edita proyectos, invalidamos el cache de matches
// para que la próxima verificación consulte la base de inmediato (si no, un
// negativo cacheado puede demorar la inyección hasta 60 s en plena demo).
const ENVIRONMENT_STORAGE_KEYS = [
  "fixea_project_id",
  "fixea_project",
  "fixea_project_target_url",
  "fixea_projects",
  "fixea_dashboard_origin",
];

const CONTENT_REFRESH_ACTION = "fixea_refresh_environment";
let environmentBroadcastTimer = null;

// Pide al content script que revalide el origen y monte/actualice el toolbar
// sin recargar la pestaña. Si la pestaña no tiene content script se ignora.
function requestTabEnvironmentRefresh(tabId) {
  if (!tabId) return;

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url) return;
    if (!/^https?:/i.test(tab.url)) return;

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

// Al cambiar de pestaña, el content script vuelve a validar el entorno. Esto
// cubre el caso de una pestaña que quedó abierta antes de registrar el sitio.
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

// Un build de producción no debe seguir usando un localhost cacheado por un
// build de desarrollo (y viceversa). Si la "familia" del origen cambió, se
// ignora el valor viejo de chrome.storage y gana el del .env.
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

// Evento al instalar o actualizar la extensión
chrome.runtime.onInstalled.addListener(() => {
  console.log("Fixea Extension instalada correctamente.");

  // Inicializar almacenamiento si no existe
  chrome.storage.local.get(["fixea_tickets", "fixea_api_base"], (result) => {
    if (!result.fixea_tickets) {
      chrome.storage.local.set({ fixea_tickets: [] });
    }

    // Limpia un origen cacheado de otra familia (dev <-> prod).
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

// Captures the visible tab as a compressed JPEG so thumbnails in the
// dashboard display the real reported screen without blowing up the DB size.
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

// Los IDs deben ser ObjectIDs de MongoDB (24 hex). Si el payload no trae uno
// válido, usamos el de la sesión activa cacheada por content.js.
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
    // Antes sólo se avisaba al Dashboard en PATCH/DELETE: un ticket nuevo no
    // aparecía en el tablero hasta recargarlo a mano.
    notifyDashboardTicketsChanged();
  }

  return {
    ok: res.ok,
    status: res.status,
    offline: false,
    data,
    error: res.ok ? null : data?.error || `El servidor respondió ${res.status}.`,
  };
}

// Avisa a las pestañas del Dashboard que la lista de tickets cambió.
// Incluye el deploy actual (Vercel o localhost) además de los locales.
async function notifyDashboardTicketsChanged() {
  try {
    const apiBase = await getApiBase();
    const patterns = new Set([`${DEFAULT_API_BASE}/*`]);

    try {
      patterns.add(`${new URL(apiBase).origin}/*`);
    } catch (error) {
      // apiBase inválida: queda sólo el patrón del build actual.
    }

    chrome.tabs.query({ url: Array.from(patterns) }, (tabs) => {
      (tabs || []).forEach((tab) => {
        if (!tab?.id) return;
        chrome.tabs.sendMessage(
          tab.id,
          { action: "fixea_tickets_changed" },
          () => {
            // La pestaña puede no tener el content script: se ignora.
            void chrome.runtime.lastError;
          }
        );
      });
    });
  } catch (error) {
    console.warn("Fixea: no se pudo avisar al Dashboard", error);
  }
}

// Lista los tickets guardados en Mongo. Lo pide content.js porque un content
// script corre con el origen del sitio anfitrión y el GET del API no expone
// CORS a propósito; el service worker sí puede leer localhost por host_permissions.
async function listTickets(projectId) {
  const apiBase = await getApiBase();
  const id = typeof projectId === "string" ? projectId.trim() : "";

  // Sin un ObjectId real no consultamos la API: no hay proyecto que pintar.
  if (!/^[a-f0-9]{24}$/i.test(id)) {
    return {
      ok: true,
      status: 200,
      offline: false,
      data: { success: true, tickets: [] },
    };
  }

  // compact=1: el overlay sólo necesita coords/estado/título, no screenshots.
  const endpoint = `${apiBase}/api/tickets?compact=1&projectId=${encodeURIComponent(id)}`;

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include",
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: res.ok, status: res.status, offline: false, data };
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

// Cambia el estado de un ticket existente (verificación / rechazo del cliente).
// Mismo endpoint que usa la web, así las transiciones se validan del lado API.
async function updateTicketStatus(remoteId, status) {
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

  // La verificación desde la extensión no viaja con la cookie del sitio, así
  // que mandamos el nombre cacheado del usuario para que el cierre quede
  // auditado con fecha + persona en Mongo.
  let verifiedByName = "";
  try {
    const stored = await chrome.storage.local.get(["fixea_author"]);
    verifiedByName =
      typeof stored?.fixea_author === "string"
        ? stored.fixea_author.trim().slice(0, 120)
        : "";
  } catch {
    verifiedByName = "";
  }

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
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
      // Refresca Dashboard y /cliente abiertos en cualquier pestaña.
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

// Borra en Mongo un ticket ya sincronizado. 404 cuenta como éxito.
async function deleteTicket(remoteId) {
  const apiBase = await getApiBase();
  const id = typeof remoteId === "string" ? remoteId.trim() : "";

  if (!id) {
    return { ok: false, status: 0, error: "Falta el id remoto del ticket" };
  }

  const endpoint = `${apiBase}/api/tickets/${encodeURIComponent(id)}`;

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "DELETE",
      headers: { Accept: "application/json" },
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

// Chequeo liviano para que el popup distinga "servidor caído" de "sin sesión".
// Cualquier respuesta HTTP (incluido 401) implica que el servidor está vivo.
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

// El match es por origen: distintas rutas del mismo sitio comparten cache.
function buildMatchKey(rawUrl) {
  const raw = typeof rawUrl === "string" ? rawUrl.trim() : "";
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return "";
    return url.origin;
  } catch (error) {
    return "";
  }
}

// Verifica contra el backend si el origen actual pertenece a un proyecto
// activo. Un fallo de red devuelve `offline: true` pero el content script lo
// ignora: una página sin match debe quedar 100% invisible.
async function matchProject(rawUrl) {
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
  const endpoint = `${apiBase}/api/projects/match?origin=${encodeURIComponent(key)}`;
  const timeoutMs = isLoopbackBase(apiBase)
    ? MATCH_TIMEOUT_DEV_MS
    : MATCH_TIMEOUT_MS;
  let res;

  // Un reintento: el primer request puede caer mientras el dev server compila
  // o mientras el service worker recién se despierta.
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

// Si el usuario dejó el acceso al sitio en "Al hacer clic" (o la pestaña se
// abrió antes de instalar/recargar la extensión), el content script declarado
// en el manifest NO corrió. El clic en el ícono otorga activeTab: inyectamos
// el content script en el documento actual, sin recargar. Recargar es
// justamente lo que en una SPA de Vercel termina en el 404 duro de /login.
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

// Sin `default_popup`, este evento sí se dispara. El content script decide si
// muestra el toolbar (match) o el cartel "Conectá FIXEA" (sin match).
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  const first = await sendShowCard(tab.id);
  if (first.delivered) return;

  if (/^https?:/i.test(tab.url || "") && (await injectContentScript(tab.id))) {
    console.info("Fixea: content script inyectado por clic en", tab.url);
    const second = await sendShowCard(tab.id);
    if (second.delivered) return;
  }

  // Páginas donde Chrome no deja inyectar (chrome://, Web Store, PDFs):
  // abrimos el Dashboard como fallback para que el clic nunca quede sin respuesta.
  getApiBase()
    .then((apiBase) => chrome.tabs.create({ url: `${apiBase}/` }))
    .catch(() => {});
});

// Listener para recibir mensajes y coordinar entre popup y content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

  if (message?.action === "delete_ticket") {
    deleteTicket(message.remoteId)
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
    updateTicketStatus(message.remoteId, message.status)
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
