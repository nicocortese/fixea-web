import React from "react";
import ReactDOM from "react-dom/client";
import ClientToolbar from "../app/components/ClientToolbar";

(() => {
  try {
    if (window.__fixeaLoaded && window.__fixeaIsAlive?.()) return;
  } catch (error) {
  }
  document.getElementById("fixea-toolbar-container")?.remove();
  window.__fixeaLoaded = true;
  window.__fixeaIsAlive = () => {
    try {
      return Boolean(chrome.runtime?.id);
    } catch (error) {
      return false;
    }
  };

  const log = (...args) => console.info("[Fixea]", ...args);
  log("content script activo en", location.href);

  const STORAGE_KEY = "fixea_custom_tickets";
  const DASHBOARD_ORIGIN = __FIXEA_API_BASE__;
  const DASHBOARD_URL = `${DASHBOARD_ORIGIN}/`;
  const OFFLINE_TOAST_MESSAGE = "Servidor de Fixea desconectado";
  const OFFLINE_DETAIL =
    "No pudimos conectar con el servidor de Fixea. Revisá tu conexión e intentá de nuevo.";
  const OFFLINE_BANNER_ID = "fixea-offline-banner";
  const LOOPBACK_RE =
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i;

  let serverReachable = true;

  function isLoopbackBase(value) {
    return LOOPBACK_RE.test(typeof value === "string" ? value.trim() : "");
  }

  function resolveStoredApiBase(value) {
    const raw =
      typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
    if (!raw) return DASHBOARD_ORIGIN;

    return isLoopbackBase(raw) === isLoopbackBase(DASHBOARD_ORIGIN)
      ? raw
      : DASHBOARD_ORIGIN;
  }

  // ---- Aislamiento del Dashboard de FIXEA ----
  const LOOPBACK_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])$/i;
  const DASHBOARD_DEV_PORTS = new Set(["3000"]);

  function parseOrigin(value) {
    try {
      return new URL(String(value || "").trim());
    } catch (error) {
      return null;
    }
  }

  function isSameAppOrigin(a, b) {
    const first = parseOrigin(a);
    const second = parseOrigin(b);
    if (!first || !second) return false;
    if (first.origin === second.origin) return true;

    return (
      LOOPBACK_HOST_RE.test(first.hostname) &&
      LOOPBACK_HOST_RE.test(second.hostname) &&
      first.protocol === second.protocol &&
      first.port === second.port
    );
  }

  function detectDashboardPage() {
    if (isSameAppOrigin(location.origin, DASHBOARD_ORIGIN)) return true;

    if (
      LOOPBACK_HOST_RE.test(location.hostname) &&
      DASHBOARD_DEV_PORTS.has(location.port)
    ) {
      return true;
    }

    try {
      if (document.querySelector('meta[name="fixea-dashboard"]')) return true;
      const cachedOrigin = localStorage.getItem("fixea_dashboard_origin") || "";
      return !!cachedOrigin && isSameAppOrigin(cachedOrigin, location.origin);
    } catch (error) {
      return false;
    }
  }

  let dashboardPageDetected = false;

  function isDashboardPage() {
    if (dashboardPageDetected) return true;
    dashboardPageDetected = detectDashboardPage();
    return dashboardPageDetected;
  }

  const SPA_404_LOOP_WINDOW_MS = 15000;
  const SPA_404_KEY_PREFIX = "fixea_404_recovered:";

  function getDocumentResponseStatus() {
    try {
      const [nav] = performance.getEntriesByType("navigation");
      const status = Number(nav?.responseStatus);
      return Number.isFinite(status) ? status : 0;
    } catch (error) {
      return 0;
    }
  }

  function normalizeText(value) {
    return (value || "")
      .replace(/[‘’ʼ]/g, "'")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  const VERCEL_REQUEST_ID_RE = /\b[a-z]{3}\d::[a-z0-9]{5}-\d{13}-[a-f0-9]{12}\b/i;
  const NOT_FOUND_CODE_RE = /\b404\b\s*[:\-–]?\s*not_found\b|\bcode\s*:\s*not_found\b/;

  function isGenericRoute404() {
    if (location.pathname === "/" || location.pathname === "") return false;

    const status = getDocumentResponseStatus();
    if (status && status !== 404) return false;

    const title = normalizeText(document.title);
    const body = normalizeText((document.body?.innerText || "").slice(0, 1500));

    const vercelNew =
      NOT_FOUND_CODE_RE.test(body) &&
      (VERCEL_REQUEST_ID_RE.test(body) ||
        body.includes("this page doesn't exist") ||
        body.includes("this page does not exist"));
    const vercelOld =
      title === "404: not_found" ||
      NOT_FOUND_CODE_RE.test(title) ||
      body.includes("404: not_found") ||
      body.includes("code: not_found");
    const nextDefault =
      title === "404: this page could not be found." ||
      (body.includes("404") && body.includes("this page could not be found"));

    return vercelNew || vercelOld || nextDefault;
  }

  function readRecoveryTimestamp(key) {
    const raw = sessionStorage.getItem(key);
    const ts = Number(raw);
    return Number.isFinite(ts) && ts > 1 ? ts : 0;
  }

  function recoverSpaRoute404() {
    if (isDashboardPage()) return false;
    if (!isGenericRoute404()) return false;

    const recoveryKey = `${SPA_404_KEY_PREFIX}${location.origin}${location.pathname}`;
    const now = Date.now();

    try {
      const lastAttempt = readRecoveryTimestamp(recoveryKey);
      if (lastAttempt && now - lastAttempt < SPA_404_LOOP_WINDOW_MS) {
        console.warn(
          "Fixea: el 404 persiste tras volver al origen; no se reintenta para evitar un loop.",
        );
        return false;
      }
      sessionStorage.setItem(recoveryKey, String(now));
    } catch (error) {
      return false;
    }

    console.info(
      "Fixea: 404 del servidor detectado. Volviendo al origen para que la SPA arranque.",
    );
    location.replace(`${location.origin}/`);
    return true;
  }

  function clearSpa404Guards() {
    if (isGenericRoute404()) return;

    try {
      const prefix = `${SPA_404_KEY_PREFIX}${location.origin}`;
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (key && key.startsWith(prefix)) sessionStorage.removeItem(key);
      }
    } catch (error) {
    }
  }

  if (!isDashboardPage()) clearSpa404Guards();

  function parseProjectList(raw) {
    try {
      const value = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function projectMatchesHost(project, currentUrl) {
    if (!project) return false;

    let current;
    try {
      current = new URL(currentUrl);
    } catch (error) {
      return false;
    }

    const currentHostname = current.hostname.toLowerCase();
    const currentPort = current.port;
    const currentUsesDefaultPort =
      !currentPort ||
      currentPort === (current.protocol === "https:" ? "443" : "80");

    const candidates = [project.targetUrl, project.url, project.siteUrl];

    for (const candidate of candidates) {
      if (typeof candidate !== "string" || !candidate.trim()) continue;

      try {
        const target = new URL(candidate);
        const targetHostname = target.hostname.toLowerCase();
        if (!targetHostname) continue;

        const targetPort = target.port;
        const targetUsesDefaultPort =
          !targetPort ||
          targetPort === (target.protocol === "https:" ? "443" : "80");

        if (
          /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(targetHostname) &&
          /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(currentHostname)
        ) {
          return true;
        }

        if (
          targetHostname === currentHostname &&
          (targetPort === currentPort ||
            (targetUsesDefaultPort && currentUsesDefaultPort))
        ) {
          return true;
        }

        if (
          targetUsesDefaultPort &&
          currentUsesDefaultPort &&
          currentHostname.endsWith(`.${targetHostname}`)
        ) {
          return true;
        }
      } catch (error) {
      }
    }

    return false;
  }

  function findProjectForHost(projects, currentUrl) {
    return (
      (projects || []).find((project) =>
        projectMatchesHost(project, currentUrl),
      ) || null
    );
  }

  function isEnvironmentLinkedToCurrentSite(env) {
    if (!env?.projectId) return false;

    const projects = Array.isArray(env.projects) ? env.projects : [];

    if (findProjectForHost(projects, location.href)) return true;

    return projectMatchesHost(
      { targetUrl: env.targetUrl || "" },
      location.href,
    );
  }

  function canAnnotate(env) {
    return isEnvironmentLinkedToCurrentSite(env);
  }

  const CONNECT_CARD_ID = "fixea-connect-card";

  function removeConnectCard() {
    const card = document.getElementById(CONNECT_CARD_ID);
    if (card) card.remove();
  }

  function clearRenderedAnnotations() {
    document
      .querySelectorAll(".fixea-pin-badge, .fixea-blur, .fixea-sticker")
      .forEach((el) => el.remove());

    const overlay = document.getElementById("fixea-overlay");
    if (overlay) {
      overlay.querySelectorAll("[data-fixea-id]").forEach((el) => el.remove());
    }

    ["fixea-modal", "fixea-status-popover", "fixea-toast"].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.remove();
    });

    pending = null;
    environmentLinked = false;
    linkedProjectId = "";
    linkedRecipient = "";
    revealedShapeIds.clear();
    statusPopoverAnn = null;
    stopRemoteRefresh();
  }

  function renderConnectCard(options = {}) {
    if (isDashboardPage()) return;
    if (!document.body) return;

    const offline = options.offline === true || !serverReachable;
    const nextState = offline ? "offline" : "online";
    const existing = document.getElementById(CONNECT_CARD_ID);

    if (existing && existing.dataset.state === nextState) return;
    if (existing) existing.remove();
    removeOfflineBanner();

    const card = document.createElement("div");
    card.id = CONNECT_CARD_ID;
    card.dataset.state = nextState;
    card.innerHTML = offline
      ? `
      <div class="fixea-connect-card-inner fixea-connect-card-offline" role="status" aria-live="polite">
        <span class="fixea-connect-icon fixea-connect-icon-offline" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 7V4a3 3 0 1 1 6 0v3"></path>
            <path d="M9 17v3a3 3 0 1 0 6 0v-3"></path>
            <rect x="4" y="7" width="16" height="10" rx="2"></rect>
          </svg>
        </span>
        <p class="fixea-connect-title">Servidor de Fixea desconectado</p>
        <p class="fixea-connect-copy">${OFFLINE_DETAIL}</p>
        <button type="button" class="fixea-connect-btn" id="fixea-connect-retry">
          Reintentar
        </button>
      </div>
    `
      : `
      <div class="fixea-connect-card-inner">
        <span class="fixea-connect-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 7V4a3 3 0 1 1 6 0v3"></path>
            <path d="M9 17v3a3 3 0 1 0 6 0v-3"></path>
            <rect x="4" y="7" width="16" height="10" rx="2"></rect>
          </svg>
        </span>
        <p class="fixea-connect-title">Conectá FIXEA</p>
        <p class="fixea-connect-copy">
          Conectá FIXEA con tu Dashboard. Abrí tu panel de control para
          seleccionar o crear un proyecto activo.
        </p>
        <button type="button" class="fixea-connect-btn" id="fixea-connect-open">
          Abrir Dashboard
        </button>
      </div>
    `;

    document.body.appendChild(card);

    card.addEventListener("click", (event) => event.stopPropagation());
    card.addEventListener("pointerdown", (event) => event.stopPropagation());

    if (offline) {
      const retryButton = card.querySelector("#fixea-connect-retry");

      if (retryButton) {
        retryButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          retryConnection();
        });
      }

      return;
    }

    const openButton = card.querySelector("#fixea-connect-open");

    if (openButton) {
      openButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.open(dashboardBaseUrl, "_blank", "noopener");
      });
    }
  }

  const UI_SELECTOR =
    "#fixea-toolbar-container, #fixea-connect-card, #fixea-modal, #fixea-toast, #fixea-offline-banner, #fixea-status-popover, .fixea-pin-badge, .fixea-sticker";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const STATUS_STYLES = {
    PENDIENTE: { color: "#00e5ff", opacity: 1 },
    EN_PROCESO: { color: "#ffea00", opacity: 0.75 },
    FINALIZADO: { color: "#00ff66", opacity: 0.45 },
  };
  const REMOTE_REFRESH_MS = 15000;
  let environmentLinked = false;
  let linkedProjectId = "";
  let linkedRecipient = "";
  let reporterIdentity = { userId: "", email: "", name: "" };
  const RECIPIENT_FALLBACK = "Programador del proyecto";
  let projectClientName = "";
  let projectDeveloperNames = [];
  let currentReporterName = "";
  let remoteRefreshTimer = null;
  let remoteRefreshHandler = null;
  let retryInFlight = false;
  let matchRequestId = 0;
  let suppressStorageReinitUntil = 0;

  const COLORS = [
    { value: "#00e5ff", name: "Cian" },
    { value: "#ff007f", name: "Magenta" },
    { value: "#7000FF", name: "Violeta" },
  ];
  const COLOR_TOOLS = ["pin", "draw", "arrow", "highlight", "blur", "sticker"];
  const DRAG_TOOLS = ["arrow", "highlight", "draw", "blur"];
  const FREEHAND_TOOLS = ["highlight", "draw"];
  const DEFAULT_TOOL = "ticket";
  const MIN_DRAG = 8;

  const BLUR_DOTS = (() => {
    const STEP = 2.6;
    const dots = [];

    for (let row = -3; row <= 3; row += 1) {
      for (let col = -3; col <= 3; col += 1) {
        const dx = col * STEP;
        const dy = row * STEP;
        const distance = Math.hypot(dx, dy);

        if (distance > 8.4) continue;

        dots.push({
          cx: 12 + dx,
          cy: 12 + dy,
          r: Math.max(0.45, 1.6 - distance * 0.14),
        });
      }
    }

    return dots;
  })();

  function blurIconMarkup() {
    const circles = BLUR_DOTS.map(
      (dot) =>
        `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="currentColor" />`,
    ).join("");

    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">${circles}</svg>`;
  }

  // ---- Estado ----
  let mode = null;
  let activeColor = COLORS[0].value;
  let isExpanded = false;
  let pending = null;
  let gesture = null;
  let suppressClickUntil = 0;
  let toastTimer = null;
  let remoteTickets = [];
  let statusPopoverEl = null;
  let statusPopoverAnn = null;
  const revealedShapeIds = new Set();
  let remoteRefreshInFlight = false;

  const pageKey = () => location.origin + location.pathname + location.search;
  const isUI = (t) => t instanceof Element && !!t.closest(UI_SELECTOR);
  const cl = (v) => Math.max(0, Math.round(v));

  function normalizeObjectId(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    return /^[a-f0-9]{24}$/i.test(raw) ? raw : null;
  }

  const DEVELOPER_ROLE_VALUES = ["developer", "admin", "programador", "dev"];

  function normalizeRole(value) {
    const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!raw) return "";
    if (DEVELOPER_ROLE_VALUES.includes(raw)) return "developer";
    if (raw === "client" || raw === "cliente") return "client";
    return raw;
  }

  function isDeveloperRole(value) {
    return normalizeRole(value) === "developer";
  }

  // ---- Contexto de la extensión ----
  let contextInvalidationWarned = false;
  let lastEnvironmentSignature = "";
  let dashboardBaseUrl = DASHBOARD_URL;

  function hasExtensionContext() {
    try {
      return typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);
    } catch (error) {
      return false;
    }
  }

  function warnContextInvalidated(error) {
    if (contextInvalidationWarned) return;
    contextInvalidationWarned = true;
    console.warn(
      "Fixea: el contexto de la extensión se invalidó (se actualizó o recargó).",
      error,
    );
  }

  // ---- Storage ----
  function getTickets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Fixea: error leyendo tickets", err);
      return [];
    }
  }

  function setTickets(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.error("Fixea: error guardando tickets", err);
    }
  }

  function saveTicket(ticket) {
    const all = getTickets();
    all.push(ticket);
    setTickets(all);
  }

  // ---- Sincronización con la API ----
  function readLocalSettings(keys, callback) {
    try {
      if (!hasExtensionContext() || !chrome.storage?.local) {
        callback({});
        return;
      }

      chrome.storage.local.get(keys, (result) => {
        try {
          if (chrome.runtime?.lastError) {
            callback({});
            return;
          }
          callback(result || {});
        } catch (error) {
          warnContextInvalidated(error);
          callback({});
        }
      });
    } catch (error) {
      warnContextInvalidated(error);
      callback({});
    }
  }

  function buildTicketPayload(ticket, settings) {
    const session = settings?.fixea_session || {};
    const projects = parseProjectList(settings?.fixea_projects);
    const matched = findProjectForHost(projects, location.href);
    const matchedId = matched ? (matched.id ?? matched._id) : null;
    const project = (matched?.name || settings?.fixea_project || "").trim();
    const author =
      String(ticket.author || "").trim() ||
      resolveReporterName(settings) ||
      "Cliente";
    const createdBy = normalizeObjectId(
      settings?.fixea_created_by || session.userId,
    );
    const role = normalizeRole(settings?.fixea_role || session.role);
    const projectId =
      normalizeObjectId(linkedProjectId) ||
      normalizeObjectId(matchedId) ||
      normalizeObjectId(settings?.fixea_project_id);

    return {
      id: ticket.id || Date.now(),
      number: ticket.number,
      type: ticket.type,
      color: ticket.color,
      shape: ticket.shape || null,
      project,
      projectId,
      title: ticket.title,
      priority: ticket.priority || "Alta",
      status: "PENDIENTE",
      author,
      createdBy,
      userId: createdBy,
      role: role || null,
      coords: ticket.coords,
      metadata: ticket.metadata || null,
      url: ticket.url || pageKey(),
      pageUrl: location.href,
      screenshotUrl: ticket.screenshotUrl || ticket.screenshot || null,
    };
  }

  function persistSyncResult(ticketId, response, payload) {
    const all = getTickets();
    const remoteId = response?.data?.ticket?._id;
    let found = false;

    const next = all.map((ticket) => {
      if (String(ticket.id) !== String(ticketId)) return ticket;
      found = true;
      return {
        ...ticket,
        project: payload.project,
        projectId: payload.projectId || null,
        author: payload.author,
        createdBy: payload.createdBy || null,
        synced: !!response?.ok,
        remoteId: remoteId ? String(remoteId) : (ticket.remoteId ?? null),
        syncError: response?.ok ? null : response?.error || "Error de red",
      };
    });

    if (found) setTickets(next);
  }

  function readDashboardProject() {
    try {
      const params = new URLSearchParams(location.search);
      const queryId = (params.get("projectId") || "").trim();
      const storedId = (localStorage.getItem("fixea_project_id") || "").trim();
      const storedName = (localStorage.getItem("fixea_project") || "").trim();
      const storedUrl = (
        localStorage.getItem("fixea_project_target_url") || ""
      ).trim();
      const projects = parseProjectList(localStorage.getItem("fixea_projects"));

      return {
        projectId: queryId || storedId,
        projectName: storedName,
        targetUrl: storedUrl,
        projects,
      };
    } catch (error) {
      return {
        projectId: "",
        projectName: "",
        targetUrl: "",
        projects: [],
      };
    }
  }

  function syncProjectKeysFromDashboard(projects) {
    if (location.origin !== DASHBOARD_ORIGIN) return;

    const incoming = {};
    (Array.isArray(projects) ? projects : []).forEach((project) => {
      const id = normalizeObjectId(project?.id ?? project?._id);
      const key =
        typeof project?.accessKey === "string" ? project.accessKey.trim() : "";
      if (id && /^FX(-[A-Z0-9]{4}){4}$/.test(key)) incoming[id] = key;
    });
    if (Object.keys(incoming).length === 0) return;

    readLocalSettings(["fixea_project_keys"], (settings) => {
      const current =
        settings?.fixea_project_keys &&
        typeof settings.fixea_project_keys === "object"
          ? settings.fixea_project_keys
          : {};
      const merged = { ...current, ...incoming };
      const changed = Object.keys(merged).some(
        (id) => merged[id] !== current[id],
      );
      if (!changed) return;
      try {
        chrome.storage.local.set({ fixea_project_keys: merged });
      } catch (error) {
        warnContextInvalidated(error);
      }
    });
  }

  function persistEnvironment(env) {
    try {
      if (!hasExtensionContext() || !chrome.storage?.local) return;

      syncProjectKeysFromDashboard(env.projects);
      env = {
        ...env,
        projects: (Array.isArray(env.projects) ? env.projects : []).map(
          ({ accessKey: _omit, ...project }) => project,
        ),
      };

      const payload = {
        fixea_session: {
          projectId: env.projectId || "",
          projectName: env.projectName || "",
          targetUrl: env.targetUrl || "",
          author: env.author || "",
          userId: env.userId || "",
          email: env.email || "",
          role: env.role || "",
          syncedAt: new Date().toISOString(),
        },
      };
      const removeKeys = [];

      if (env.projectId) payload.fixea_project_id = env.projectId;
      else removeKeys.push("fixea_project_id");

      if (env.projectName) payload.fixea_project = env.projectName;
      else removeKeys.push("fixea_project");

      if (env.targetUrl) payload.fixea_project_target_url = env.targetUrl;
      else removeKeys.push("fixea_project_target_url");

      if (Array.isArray(env.projects) && env.projects.length > 0) {
        payload.fixea_projects = env.projects;
      } else {
        removeKeys.push("fixea_projects");
      }

      if (env.author && normalizeRole(env.role) === "client") {
        payload.fixea_author = env.author;
      }

      if (env.userId) payload.fixea_created_by = env.userId;
      else removeKeys.push("fixea_created_by");

      if (env.role) payload.fixea_role = normalizeRole(env.role);
      else removeKeys.push("fixea_role");

      payload.fixea_is_developer = isDeveloperRole(env.role);
      payload.fixea_api_base = location.origin;

      chrome.storage.local.set(payload, () => {
        if (removeKeys.length > 0) {
          chrome.storage.local.remove(removeKeys);
        }
      });
    } catch (error) {
      warnContextInvalidated(error);
    }
  }

  async function resolveDashboardEnvironment() {
    const project = readDashboardProject();
    let user = null;
    let authStatus = "unknown";

    try {
      const res = await fetch(`${location.origin}/api/auth/me`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success && data.user) {
        user = data.user;
        authStatus = "authenticated";
      } else if (res.status === 401) {
        authStatus = "anonymous";
      }

      setServerReachable(true, { notify: false });
    } catch (error) {
      authStatus = "offline";
      setServerReachable(false);
    }

    if (authStatus !== "authenticated" && authStatus !== "anonymous") {
      return new Promise((resolve) => readCachedEnvironment(resolve));
    }

    const env =
      authStatus === "anonymous"
        ? {
            projectId: "",
            projectName: "",
            targetUrl: "",
            projects: [],
            author: "",
            userId: "",
            email: "",
            role: "",
            linked: false,
          }
        : {
            projectId: normalizeObjectId(project.projectId) || "",
            projectName: project.projectName,
            targetUrl: project.targetUrl,
            projects: project.projects,
            author: (user?.name || "").trim() || (user?.email || "").trim(),
            userId: normalizeObjectId(user?.id) || "",
            email: (user?.email || "").trim(),
            role: (user?.role || "").trim(),
            linked: Boolean(
              (normalizeObjectId(user?.id) || (user?.role || "").trim()) &&
                (normalizeObjectId(project.projectId) || project.projectId),
            ),
          };

    const signature = [
      env.projectId,
      env.projectName,
      env.targetUrl,
      JSON.stringify(env.projects),
      env.author,
      env.userId,
      env.email,
      env.role,
    ].join("|");

    if (signature !== lastEnvironmentSignature) {
      lastEnvironmentSignature = signature;
      persistEnvironment(env);
    }

    return env;
  }

  function readCachedEnvironment(callback) {
    readLocalSettings(
      [
        "fixea_project_id",
        "fixea_project",
        "fixea_project_target_url",
        "fixea_project_recipient",
        "fixea_projects",
        "fixea_author",
        "fixea_created_by",
        "fixea_session",
        "fixea_api_base",
        "fixea_role",
        "fixea_project_client_name",
      ],
      (settings) => {
        const session = settings?.fixea_session || {};
        if (!projectClientName && settings?.fixea_project_client_name) {
          projectClientName = String(settings.fixea_project_client_name).trim();
        }
        currentReporterName = resolveReporterName(settings);
        const projects = parseProjectList(settings?.fixea_projects);
        const apiBase = resolveStoredApiBase(settings?.fixea_api_base);
        dashboardBaseUrl = `${apiBase}/`;

        const matched = findProjectForHost(projects, location.href);
        const matchedId = matched
          ? String(matched.id ?? matched._id ?? "")
          : "";

        const env = {
          projectId:
            matchedId || settings?.fixea_project_id || session.projectId || "",
          projectName:
            matched?.name ||
            "" ||
            settings?.fixea_project ||
            session.projectName ||
            "",
          targetUrl:
            matched?.targetUrl ||
            "" ||
            settings?.fixea_project_target_url ||
            session.targetUrl ||
            "",
          recipient:
            (matched && matched.recipient) ||
            settings?.fixea_project_recipient ||
            session.recipient ||
            "",
          projects,
          author: currentReporterName || session.author || "",
          userId: settings?.fixea_created_by || session.userId || "",
          email: session.email || "",
          role: session.role || "",
        };

        reporterIdentity =
          normalizeRole(env.role) === "developer"
            ? { userId: "", email: "", name: currentReporterName }
            : {
                userId: String(env.userId || ""),
                email: String(env.email || ""),
                name: currentReporterName || String(env.author || ""),
              };

        callback({
          ...env,
          linked: canAnnotate(env),
        });
      },
    );
  }

  function getEnvironment(callback) {
    if (isDashboardPage()) {
      resolveDashboardEnvironment()
        .then(callback)
        .catch(() => readCachedEnvironment(callback));
      return;
    }
    readCachedEnvironment(callback);
  }

  function sendTicketToBackground(payload, callback) {
    try {
      if (!hasExtensionContext() || !chrome.runtime?.sendMessage) {
        callback({
          ok: false,
          status: 0,
          error: "chrome.runtime no disponible",
        });
        return;
      }

      chrome.runtime.sendMessage(
        { action: "create_ticket", payload },
        (response) => {
          try {
            if (chrome.runtime?.lastError) {
              callback({
                ok: false,
                status: 0,
                error: chrome.runtime.lastError.message,
              });
              return;
            }
            callback(
              response || { ok: false, status: 0, error: "Sin respuesta" },
            );
          } catch (error) {
            warnContextInvalidated(error);
            callback({ ok: false, status: 0, error: "Contexto invalidado" });
          }
        },
      );
    } catch (error) {
      warnContextInvalidated(error);
      callback({
        ok: false,
        status: 0,
        error: error?.message || "Error al enviar el ticket",
      });
    }
  }

  function sendDeleteToBackground(remoteId, callback) {
    try {
      if (!hasExtensionContext() || !chrome.runtime?.sendMessage) {
        callback({
          ok: false,
          status: 0,
          error: "chrome.runtime no disponible",
        });
        return;
      }

      chrome.runtime.sendMessage(
        {
          action: "delete_ticket",
          remoteId,
          projectId: linkedProjectId,
          pageUrl: location.href,
        },
        (response) => {
          try {
            if (chrome.runtime?.lastError) {
              callback({
                ok: false,
                status: 0,
                error: chrome.runtime.lastError.message,
              });
              return;
            }
            callback(
              response || { ok: false, status: 0, error: "Sin respuesta" },
            );
          } catch (error) {
            warnContextInvalidated(error);
            callback({ ok: false, status: 0, error: "Contexto invalidado" });
          }
        },
      );
    } catch (error) {
      warnContextInvalidated(error);
      callback({
        ok: false,
        status: 0,
        error: error?.message || "Error al borrar el ticket",
      });
    }
  }

  function setFixeaUiHidden(hidden) {
    document.querySelectorAll(UI_SELECTOR).forEach((el) => {
      if (hidden) {
        el.style.setProperty("visibility", "hidden", "important");
        el.style.setProperty("opacity", "0", "important");
      } else {
        el.style.removeProperty("visibility");
        el.style.removeProperty("opacity");
      }
    });
  }

  function captureScreenshot(callback) {
    if (!hasExtensionContext() || !chrome.runtime?.sendMessage) {
      callback(null);
      return;
    }

    setFixeaUiHidden(true);

    let settled = false;
    let timer = null;

    const finish = (screenshotUrl) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      setFixeaUiHidden(false);
      callback(screenshotUrl);
    };

    timer = setTimeout(() => finish(null), 5000);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          chrome.runtime.sendMessage(
            { action: "capture_screenshot" },
            (response) => {
              try {
                if (chrome.runtime?.lastError) {
                  finish(null);
                  return;
                }
                finish(response?.screenshotUrl || null);
              } catch (error) {
                warnContextInvalidated(error);
                finish(null);
              }
            },
          );
        } catch (error) {
          warnContextInvalidated(error);
          finish(null);
        }
      });
    });
  }

  function attachScreenshot(ticketId, screenshotUrl) {
    const all = getTickets();
    let changed = false;

    const next = all.map((ticket) => {
      if (String(ticket.id) !== String(ticketId)) return ticket;
      changed = true;
      return { ...ticket, screenshotUrl };
    });

    if (changed) setTickets(next);
  }

  function syncTicket(ticket, options = {}) {
    if (!ticket) return;

    try {
      if (!hasExtensionContext()) {
        warnContextInvalidated();
        if (typeof options.onDone === "function") {
          options.onDone(false, { error: "contexto_invalidado" });
        }
        return;
      }

      const { silent = false, onDone } = options;

      readLocalSettings(
        [
          "fixea_project",
          "fixea_project_id",
          "fixea_project_target_url",
          "fixea_projects",
          "fixea_author",
          "fixea_created_by",
          "fixea_session",
          "fixea_role",
          "fixea_is_developer",
          "fixea_project_client_name",
        ],
        (settings) => {
          try {
            const send = (screenshotUrl) => {
              const payload = buildTicketPayload(
                screenshotUrl ? { ...ticket, screenshotUrl } : ticket,
                settings,
              );

              const failNoProject = () => {
                persistSyncResult(
                  ticket.id,
                  { ok: false, error: "Sin proyecto vinculado" },
                  payload,
                );

                if (!silent) {
                  showToast(
                    "Este sitio no coincide con ningún proyecto de FIXEA. Revisá la URL del proyecto.",
                    "danger",
                  );
                }

                if (typeof onDone === "function") {
                  onDone(false, { error: "sin_proyecto" });
                }
              };

              fixeaApiRequest(
                `/api/projects/match?url=${encodeURIComponent(location.href)}`,
              ).then((match) => {
                const project = match?.data?.project;
                const id = normalizeObjectId(project?.id || project?._id);

                if (match?.ok && match.data?.match === true && id) {
                  if (id !== linkedProjectId || id !== payload.projectId) {
                    linkedProjectId = id;
                    persistMatchedProject(project);
                  }
                  payload.projectId = id;
                  if (project?.name) payload.project = project.name;
                  deliver();
                  return;
                }

                if (match?.ok && match.data?.match === false) {
                  failNoProject();
                  return;
                }

                if (payload.projectId) deliver();
                else failNoProject();
              });

              function deliver() {
              sendTicketToBackground(payload, (response) => {
                persistSyncResult(ticket.id, response, payload);

                if (!response?.ok) {
                  const offline = isOfflineResponse(response);

                  if (offline) setServerReachable(false);

                  if (!silent) {
                    showToast(
                      offline
                        ? "Servidor de Fixea desconectado. El ticket quedó guardado y se reenviará."
                        : `No se pudo enviar el ticket: ${
                            response?.error || `error ${response?.status || ""}`.trim()
                          }`,
                      offline ? "error" : "danger",
                    );
                  } else {
                    console.warn(
                      "Fixea: no se pudo sincronizar el ticket",
                      ticket.id,
                      response?.error,
                    );
                  }
                }

                if (typeof onDone === "function") {
                  onDone(!!response?.ok, response);
                }
              });
              }
            };

            if (ticket.screenshotUrl || ticket.screenshot) {
              send(null);
              return;
            }

            captureScreenshot((screenshotUrl) => {
              if (screenshotUrl) attachScreenshot(ticket.id, screenshotUrl);
              send(screenshotUrl);
            });
          } catch (error) {
            warnContextInvalidated(error);
            if (typeof onDone === "function") onDone(false, { error: "excepcion" });
          }
        },
      );
    } catch (error) {
      warnContextInvalidated(error);
      if (typeof options.onDone === "function") {
        options.onDone(false, { error: "excepcion" });
      }
    }
  }

  function retryPendingTickets() {
    if (isDashboardPage()) return;
    getTickets()
      .filter((ticket) => ticket.synced !== true)
      .forEach((ticket) => syncTicket(ticket, { silent: true }));
  }

  function removeTicket(id) {
    const remaining = getTickets()
      .filter((t) => String(t.id) !== String(id))
      .map((t, i) => ({ ...t, number: i + 1 }));
    setTickets(remaining);
    return remaining;
  }

  const nextTicketNumber = () => getTickets().length + 1;
  const pageTickets = () =>
    getTickets().filter((ticket) => {
      if (!ticket.coords || ticket.url !== pageKey()) return false;
      if (!linkedProjectId) return false;
      if (ticket.projectId == null || String(ticket.projectId) === "") return true;
      return String(ticket.projectId) === linkedProjectId;
    });

  function statusOf(ticket) {
    const raw =
      typeof ticket?.status === "string"
        ? ticket.status.trim().toUpperCase()
        : "";
    return STATUS_STYLES[raw] ? raw : "PENDIENTE";
  }

  function remoteIdOf(ticket) {
    const value =
      ticket?.remoteId != null
        ? ticket.remoteId
        : ticket?._id != null
          ? ticket._id
          : null;
    return value != null ? String(value) : "";
  }

  function mergeRemoteState(localTickets, remoteList) {
    const byRemoteId = new Map();

    remoteList.forEach((ticket) => {
      [ticket?._id, ticket?.id].forEach((value) => {
        if (value != null) byRemoteId.set(String(value), ticket);
      });
    });

    return localTickets.map((ticket) => {
      const remote = byRemoteId.get(remoteIdOf(ticket));
      if (!remote) return ticket;

      return {
        ...ticket,
        status: remote.status || ticket.status,
        devNote: remote.devNote ?? ticket.devNote,
      };
    });
  }

  function remoteAnnotations() {
    return remoteTickets
      .filter((ticket) => {
        if (!ticket?.coords || ticket.url !== pageKey()) return false;
        if (!linkedProjectId) return false;
        return String(ticket.projectId || "") === linkedProjectId;
      })
      .map((ticket) => {
        const id = String(ticket._id ?? ticket.id);
        return {
          id,
          remoteId: id,
          number: ticket.number ?? null,
          type: ticket.type || "pin",
          color: ticket.color || COLORS[0].value,
          shape: ticket.shape || null,
          title: ticket.title || "",
          priority: ticket.priority || "Alta",
          status: ticket.status || "PENDIENTE",
          devNote: ticket.devNote || "",
          coords: ticket.coords,
          metadata: ticket.metadata || null,
          url: ticket.url,
          author: ticket.author || "Cliente",
          fromRemote: true,
        };
      });
  }

  function allPageTickets() {
    const local = mergeRemoteState(pageTickets(), remoteTickets);
    const linkedRemoteIds = new Set(local.map(remoteIdOf).filter(Boolean));

    const remoteOnly = remoteAnnotations().filter(
      (ticket) => !linkedRemoteIds.has(ticket.remoteId),
    );

    return [...local, ...remoteOnly];
  }

  function patchLocalTicketStatus(remoteId, status, devNote) {
    let changed = false;

    const next = getTickets().map((ticket) => {
      if (remoteIdOf(ticket) !== String(remoteId)) return ticket;
      changed = true;
      return {
        ...ticket,
        status,
        devNote: devNote !== undefined ? devNote : ticket.devNote,
      };
    });

    if (changed) setTickets(next);
    return changed;
  }

  function applyBadgeStatus(badge, status) {
    const normalized = statusOf({ status });
    badge.dataset.fixeaStatus = normalized;
    const stickerColor = badge.dataset.fixeaStickerColor;
    const chosenColor = badge.dataset.fixeaChosenColor;
    badge.style.setProperty(
      "--fixea-status-c",
      stickerColor ||
        (normalized === "FINALIZADO" && chosenColor) ||
        STATUS_STYLES[normalized].color,
    );
  }

  // ---- Colores del post-it ----
  const INK_DARK = "#0B0C10";
  const INK_LIGHT = "#FFFFFF";

  function relativeLuminance(hex) {
    const value = safeHexColor(hex).slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => {
      const channel = parseInt(value.slice(i, i + 2), 16) / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function inkFor(hex) {
    const fill = relativeLuminance(hex);
    const contrast = (other) =>
      (Math.max(fill, other) + 0.05) / (Math.min(fill, other) + 0.05);
    return contrast(relativeLuminance(INK_DARK)) >= contrast(1)
      ? INK_DARK
      : INK_LIGHT;
  }

  function safeHexColor(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return `#${raw
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")}`.toLowerCase();
    }
    return COLORS[0].value;
  }

  function hexToRgba(hex, alpha) {
    const value = safeHexColor(hex).slice(1);
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function stickerColorOf(ann) {
    return safeHexColor(ann?.color);
  }

  const expandedStickerIds = new Set();

  function setStickerExpanded(ann, expanded) {
    const id = String(ann.id);
    if (expanded) expandedStickerIds.add(id);
    else expandedStickerIds.delete(id);

    document
      .querySelectorAll(`.fixea-sticker[data-fixea-id="${id}"]`)
      .forEach((el) => el.remove());
    if (expanded) createStickerCard(ann);

    document
      .querySelectorAll(`.fixea-pin-badge[data-fixea-id="${id}"]`)
      .forEach((badge) => {
        badge.classList.toggle("fixea-pin-open", expanded);
        badge.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
  }

  function refreshBadgeStatus(annotationId, status) {
    document
      .querySelectorAll(`.fixea-pin-badge[data-fixea-id="${annotationId}"]`)
      .forEach((badge) => applyBadgeStatus(badge, status));
  }

  function fixeaApiRequest(path, { method = "GET", body, projectId } = {}) {
    const direct = async () => {
      try {
        const res = await fetch(`${DASHBOARD_ORIGIN}${path}`, {
          method,
          headers: {
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          offline: true,
          data: null,
          error: error?.message || "Error de red",
        };
      }
    };

    if (!hasExtensionContext() || !chrome.runtime?.sendMessage) return direct();

    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "FIXEA_API_REQUEST", path, method, body, projectId },
          (response) => {
            if (chrome.runtime?.lastError || !response) {
              direct().then(resolve);
              return;
            }
            resolve(response);
          },
        );
      } catch (error) {
        warnContextInvalidated(error);
        direct().then(resolve);
      }
    });
  }

  function sendToBackground(message, callback) {
    try {
      if (!hasExtensionContext() || !chrome.runtime?.sendMessage) {
        callback({
          ok: false,
          status: 0,
          error: "chrome.runtime no disponible",
        });
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        try {
          if (chrome.runtime?.lastError) {
            callback({
              ok: false,
              status: 0,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          callback(
            response || { ok: false, status: 0, error: "Sin respuesta" },
          );
        } catch (error) {
          warnContextInvalidated(error);
          callback({ ok: false, status: 0, error: "Contexto invalidado" });
        }
      });
    } catch (error) {
      warnContextInvalidated(error);
      callback({
        ok: false,
        status: 0,
        error: error?.message || "Error al contactar el background",
      });
    }
  }

  function startRemoteRefresh() {
    if (isDashboardPage()) return;
    if (!remoteRefreshHandler) {
      remoteRefreshHandler = () => refreshRemoteTickets();
      window.addEventListener("focus", remoteRefreshHandler);
    }

    if (!remoteRefreshTimer) {
      remoteRefreshTimer = setInterval(() => {
        if (document.visibilityState === "visible") refreshRemoteTickets();
      }, REMOTE_REFRESH_MS);
    }
  }

  function stopRemoteRefresh() {
    if (remoteRefreshHandler) {
      window.removeEventListener("focus", remoteRefreshHandler);
      remoteRefreshHandler = null;
    }

    if (remoteRefreshTimer) {
      clearInterval(remoteRefreshTimer);
      remoteRefreshTimer = null;
    }
  }

  function refreshRemoteTickets(done) {
    const finish = (ok) => {
      if (typeof done === "function") done(ok);
    };

    if (isDashboardPage()) return finish(false);
    if (!environmentLinked || !linkedProjectId) return finish(false);
    if (!hasExtensionContext()) return finish(false);
    if (remoteRefreshInFlight) return finish(false);

    remoteRefreshInFlight = true;

    sendToBackground(
      { action: "list_tickets", projectId: linkedProjectId },
      (response) => {
        remoteRefreshInFlight = false;

        if (response?.needsKey) {
          finish(false);
          return;
        }

        if (isOfflineResponse(response)) {
          setServerReachable(false);
          if (remoteTickets.length > 0) {
            remoteTickets = [];
            renderSavedAnnotations();
          }
          finish(false);
          return;
        }

        if (!response?.ok || !Array.isArray(response?.data?.tickets)) {
          if (response?.offline === false) {
            setServerReachable(true, { notify: false });
          }
          finish(false);
          return;
        }

        setServerReachable(true);
        remoteTickets = response.data.tickets.filter(
          (ticket) => String(ticket?.projectId || "") === linkedProjectId,
        );
        renderSavedAnnotations();
        finish(true);
      },
    );
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function hitAnnotation(a, px, py) {
    const s = a.shape || {};
    const badgeR = a.type === "pin" ? 18 : 12;
    if (a.coords && Math.hypot(px - a.coords.x, py - a.coords.y) <= badgeR)
      return true;

    switch (a.type) {
      case "arrow":
        return distToSegment(px, py, s.x1, s.y1, s.x2, s.y2) <= 12;
      case "draw":
      case "highlight": {
        const p = s.points || [];
        for (let i = 0; i < p.length - 1; i++) {
          if (
            distToSegment(px, py, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) <=
            14
          )
            return true;
        }
        return false;
      }
      case "blur":
      case "sticker":
        return (
          px >= s.x - 6 &&
          px <= s.x + s.w + 6 &&
          py >= s.y - 6 &&
          py <= s.y + s.h + 6
        );
      default:
        return false;
    }
  }

  function escapeSelectorValue(value) {
    const str = String(value);
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(str);
    }
    return str.replace(/^(\d)/, "\\3$1 ").replace(/([^\w-])/g, "\\$1");
  }

  function isUniqueId(id) {
    if (!id) return false;
    try {
      return (
        document.querySelectorAll(`#${escapeSelectorValue(id)}`).length === 1
      );
    } catch (err) {
      return false;
    }
  }

  function buildCssSelector(target) {
    if (!(target instanceof Element)) return "";

    if (isUniqueId(target.id)) {
      return `#${escapeSelectorValue(target.id)}`;
    }

    const uniqueAttrs = ["data-testid", "data-test", "aria-label", "name"];
    for (const attr of uniqueAttrs) {
      const rawValue = target.getAttribute(attr);
      if (!rawValue) continue;

      const escapedValue = String(rawValue)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
      const selector = `${target.tagName.toLowerCase()}[${attr}="${escapedValue}"]`;

      try {
        if (document.querySelectorAll(selector).length === 1) return selector;
      } catch (err) {}
    }

    const segments = [];
    let node = target;

    while (node instanceof Element) {
      if (node !== target && isUniqueId(node.id)) {
        segments.unshift(`#${escapeSelectorValue(node.id)}`);
        break;
      }

      const parent = node.parentElement;
      let segment = node.tagName.toLowerCase();

      if (parent) {
        const sameTag = Array.from(parent.children).filter(
          (child) => child.tagName === node.tagName,
        );
        if (sameTag.length > 1) {
          segment += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
        }
      }

      segments.unshift(segment);
      if (segments.join(" > ").length > 400) return "";
      node = parent;
    }

    const selector = segments.join(" > ");
    if (!selector) return "";

    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === target ? selector : "";
    } catch (err) {
      return "";
    }
  }

  function captureDomMetadata(target) {
    return {
      selector: buildCssSelector(target),
      screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      browserInfo: navigator.userAgent,
      url: window.location.href,
    };
  }

  function pageRectOf(target) {
    if (!(target instanceof Element)) return null;
    if (target === document.body || target === document.documentElement) {
      return null;
    }
    const r = target.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: Math.round(r.left + window.scrollX),
      y: Math.round(r.top + window.scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  }

  const BLUR_ELEMENT_MAX = { w: 520, h: 280 };
  const BLUR_CLICK_DEFAULT = { w: 96, h: 40 };
  const BLUR_PADDING = 2;

  function blurRectForClick(g) {
    const t = g.targetRect;
    if (t && t.w <= BLUR_ELEMENT_MAX.w && t.h <= BLUR_ELEMENT_MAX.h) {
      return {
        x: cl(t.x - BLUR_PADDING),
        y: cl(t.y - BLUR_PADDING),
        w: t.w + BLUR_PADDING * 2,
        h: t.h + BLUR_PADDING * 2,
      };
    }
    return {
      x: cl(g.x0 - BLUR_CLICK_DEFAULT.w / 2),
      y: cl(g.y0 - BLUR_CLICK_DEFAULT.h / 2),
      w: BLUR_CLICK_DEFAULT.w,
      h: BLUR_CLICK_DEFAULT.h,
    };
  }

  function strokePoints(g) {
    if (g.straight && g.dragging) return [[g.x0, g.y0], [g.x, g.y]];
    return g.points;
  }

  function buildAnnotation(g) {
    const { id, type, color, x0, y0, x, y } = g;
    const base = { id, type, color, metadata: g.metadata || null };

    switch (type) {
      case "arrow": {
        const s = g.dragging
          ? { x1: x0, y1: y0, x2: x, y2: y }
          : { x1: cl(x0 - 70), y1: cl(y0 - 70), x2: x0, y2: y0 };
        return { ...base, coords: { x: s.x1, y: s.y1 }, shape: s };
      }
      case "draw": {
        const pts = g.dragging ? strokePoints(g) : [[x0, y0]];
        return {
          ...base,
          coords: { x: pts[0][0], y: pts[0][1] },
          shape: { points: pts },
        };
      }
      case "highlight": {
        const pts = g.dragging
          ? strokePoints(g)
          : [
              [cl(x0 - 45), y0],
              [x0 + 45, y0],
            ];
        return {
          ...base,
          coords: { x: pts[0][0], y: pts[0][1] },
          shape: { points: pts },
        };
      }
      case "blur": {
        const s = g.dragging
          ? {
              x: Math.min(x0, x),
              y: Math.min(y0, y),
              w: Math.max(4, Math.abs(x - x0)),
              h: Math.max(4, Math.abs(y - y0)),
            }
          : blurRectForClick(g);
        return { ...base, coords: { x: s.x, y: s.y }, shape: s };
      }
      case "sticker": {
        const s = { x: x0, y: y0, w: 150, h: 100 };
        return { ...base, coords: { x: x0, y: y0 }, shape: s };
      }
      default:
        return { ...base, type: "pin", coords: { x: x0, y: y0 }, shape: null };
    }
  }

  function svgEl(name, attrs, parent) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) =>
      el.setAttribute(k, String(v)),
    );
    if (parent) parent.appendChild(el);
    return el;
  }

  function ensureOverlay() {
    let o = document.getElementById("fixea-overlay");
    if (o) return o;
    o = svgEl("svg", { id: "fixea-overlay", width: 1, height: 1 });
    document.body.appendChild(o);
    syncCursor();
    return o;
  }

  function wrapText(str, max, maxLines) {
    const words = String(str || "")
      .split(/\s+/)
      .filter(Boolean);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = (cur + " " + w).trim();
      if (next.length <= max) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = w.slice(0, max);
      }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, max - 1) + "…";
    }
    return lines;
  }

  function drawShape(ann) {
    if (ann.type === "pin" || ann.type === "blur" || ann.type === "sticker" || !ann.shape) return;
    const overlay = ensureOverlay();
    const old = overlay.querySelector(`[data-fixea-id="${ann.id}"]`);
    if (old) old.remove();

    const g = svgEl(
      "g",
      { class: "fixea-shape", "data-fixea-id": ann.id },
      overlay,
    );
    const c = ann.color;
    const s = ann.shape;

    if (ann.type === "arrow") {
      const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const head = 16;
      const spread = Math.PI / 7;
      const ax = s.x2 - head * Math.cos(ang - spread);
      const ay = s.y2 - head * Math.sin(ang - spread);
      const bx = s.x2 - head * Math.cos(ang + spread);
      const by = s.y2 - head * Math.sin(ang + spread);
      svgEl(
        "path",
        {
          d: `M${s.x1} ${s.y1}L${s.x2} ${s.y2}M${ax} ${ay}L${s.x2} ${s.y2}L${bx} ${by}`,
          fill: "none",
          stroke: c,
          "stroke-width": 4,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        g,
      );
    } else if (ann.type === "draw") {
      const pts = s.points || [];
      const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("");
      svgEl(
        "path",
        {
          d: pts.length === 1 ? `${d}L${pts[0][0]} ${pts[0][1]}` : d,
          fill: "none",
          stroke: c,
          "stroke-width": 4,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        g,
      );
    } else if (ann.type === "highlight") {
      const pts = s.points;
      const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join("");
      svgEl(
        "path",
        {
          d: pts.length === 1 ? `${d}L${pts[0][0]} ${pts[0][1]}` : d,
          fill: "none",
          stroke: c,
          "stroke-opacity": 0.4,
          "stroke-width": 18,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        },
        g,
      );
    }
  }

  let badgeGradientSeq = 0;

  function fixeaMarkSvg() {
    badgeGradientSeq += 1;
    const gid = `fixea-x-grad-${badgeGradientSeq}`;
    return `<svg class="fixea-x-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${gid}" x1="4" y1="12" x2="20" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#00E5FF"/>
          <stop offset="0.5" stop-color="#7000FF"/>
          <stop offset="1" stop-color="#FF007F"/>
        </linearGradient>
      </defs>
      <path class="fixea-x-stroke" d="M5 5 19 19M19 5 5 19" stroke="url(#${gid})" stroke-width="4.2" stroke-linecap="round" fill="none"/>
    </svg>`;
  }

  function createBadge(ann) {
    const b = document.createElement("div");
    const isSticker = ann.type === "sticker";
    b.className =
      "fixea-pin-badge fixea-pin-actionable" +
      (isSticker
        ? " fixea-pin-sticker"
        : ann.type === "pin"
          ? ""
          : " fixea-pin-small");
    b.dataset.fixeaId = String(ann.id);
    b.style.left = `${ann.coords.x}px`;
    b.style.top = `${ann.coords.y}px`;
    b.style.setProperty("--fixea-c", ann.color);
    b.dataset.fixeaChosenColor = safeHexColor(ann.color);
    if (isSticker) {
      b.dataset.fixeaStickerColor = safeHexColor(ann.color);
      const open = expandedStickerIds.has(String(ann.id));
      b.classList.toggle("fixea-pin-open", open);
      b.setAttribute("aria-expanded", open ? "true" : "false");
    }
    b.setAttribute("role", "button");
    b.setAttribute(
      "aria-label",
      ann.title ? `Ticket: ${ann.title}` : "Ticket de Fixea",
    );
    b.innerHTML = fixeaMarkSvg();
    applyBadgeStatus(b, statusOf(ann));

    b.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (mode === "erase") {
        eraseTicket(ann.id);
        return;
      }

      if (isSticker) {
        setStickerExpanded(ann, !expandedStickerIds.has(String(ann.id)));
        return;
      }

      openStatusPopover(ann, b);
    });

    document.body.appendChild(b);
    return b;
  }

  function createBlurBox(ann) {
    if (ann.type !== "blur" || !ann.shape) return;
    document
      .querySelectorAll(`.fixea-blur[data-fixea-id="${ann.id}"]`)
      .forEach((el) => el.remove());

    const box = document.createElement("div");
    box.className = "fixea-blur";
    box.dataset.fixeaId = String(ann.id);
    box.style.left = `${ann.shape.x}px`;
    box.style.top = `${ann.shape.y}px`;
    box.style.width = `${Math.max(1, ann.shape.w)}px`;
    box.style.height = `${Math.max(1, ann.shape.h)}px`;
    document.body.appendChild(box);
  }

  function createStickerCard(ann) {
    if (isDashboardPage()) return;
    if (ann.type !== "sticker" || !ann.shape) return;

    document
      .querySelectorAll(`.fixea-sticker[data-fixea-id="${ann.id}"]`)
      .forEach((el) => el.remove());

    const shape = ann.shape;
    const status = statusOf(ann);
    const accent = stickerColorOf(ann);
    const ink = inkFor(accent);
    const card = document.createElement("div");
    card.className = "fixea-sticker";
    card.dataset.fixeaId = String(ann.id);
    card.dataset.fixeaStatus = status;
    card.dataset.fixeaInk = ink === INK_DARK ? "dark" : "light";
    card.style.setProperty("--fixea-sticker-fill", accent);
    card.style.setProperty("--fixea-sticker-ink", ink);
    card.style.setProperty("--fixea-sticker-accent-solid", accent);
    card.style.setProperty("--fixea-sticker-accent", hexToRgba(accent, 0.55));
    card.style.setProperty("--fixea-sticker-glow", hexToRgba(accent, 0.22));
    const cardWidth = Math.max(190, Math.round(shape.w || 0));
    const maxLeft = Math.max(
      window.scrollX + 8,
      window.scrollX + window.innerWidth - cardWidth - 8,
    );
    card.style.left = `${Math.min(Math.max(window.scrollX + 8, shape.x + 24), maxLeft)}px`;
    card.style.top = `${shape.y + 24}px`;
    card.style.width = `${cardWidth}px`;
    card.innerHTML = `
      <div class="fixea-sticker-head">
        <span class="fixea-sticker-mark" aria-hidden="true">${fixeaMarkSvg()}</span>
        <span class="fixea-sticker-dot" aria-hidden="true"></span>
        <span class="fixea-sticker-state">${escapeHtml(statusLabel(status))}</span>
        <button type="button" class="fixea-sticker-min" aria-label="Minimizar post-it" title="Minimizar">${CLOSE_SVG}</button>
      </div>
      <p class="fixea-sticker-text">"${escapeHtml(ann.title || "Nueva corrección")}"</p>
    `;

    card
      .querySelector(".fixea-sticker-min")
      .addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setStickerExpanded(ann, false);
      });

    card.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (mode === "erase") {
        eraseTicket(ann.id);
        return;
      }

      openStatusPopover(ann, null);
    });

    document.body.appendChild(card);
    return card;
  }

  function normalizeAnnotation(ticket) {
    const ann = {
      ...ticket,
      type: ticket.type || "pin",
      color: ticket.color || COLORS[0].value,
      status: statusOf(ticket),
      remoteId: remoteIdOf(ticket) || null,
    };
    if (ann.type === "grid") ann.type = "blur";
    if (ann.type !== "pin" && !ann.shape) ann.type = "pin";
    return ann;
  }

  function renderAnnotation(ann) {
    createBlurBox(ann);

    if (ann.type === "sticker") {
      if (expandedStickerIds.has(String(ann.id))) createStickerCard(ann);
    } else if (
      ann.type !== "arrow" ||
      revealedShapeIds.has(String(ann.id))
    ) {
      drawShape(ann);
    }

    createBadge(ann);
  }

  function removeAnnotation(id) {
    document
      .querySelectorAll(`[data-fixea-id="${id}"]`)
      .forEach((el) => el.remove());
  }

  let annotationsDirty = false;

  function renderSavedAnnotations() {
    if (isDashboardPage()) return;
    if (pending || statusPopoverEl) {
      annotationsDirty = true;
      return;
    }
    annotationsDirty = false;

    document
      .querySelectorAll(
        ".fixea-pin-badge, .fixea-blur, .fixea-sticker, [data-fixea-ticket-pin]",
      )
      .forEach((el) => el.remove());

    const tickets = allPageTickets();
    if (!Array.isArray(tickets) || tickets.length === 0) return;

    tickets.forEach((t) => {
      if (!t || !t.coords) return;
      const ann = normalizeAnnotation(t);

      if (!isExpanded && ann.status === "FINALIZADO" && ann.type !== "sticker") {
        createBadge(ann);
        return;
      }

      renderAnnotation(ann);
    });
  }

  function discardPending() {
    if (!pending) return;
    removeAnnotation(pending.ann.id);
    pending.modalEl.remove();
    pending = null;
    if (annotationsDirty) renderSavedAnnotations();
  }

  function cancelGesture() {
    if (!gesture) return;
    removeAnnotation(gesture.id);
    gesture = null;
  }

  function updateColorPill() {
    const container = document.getElementById("fixea-toolbar-container");
    if (container) container.style.setProperty("--fixea-color", activeColor);

    const pill = document.getElementById("fixea-color-pill");
    if (!pill) return;

    const show = isExpanded && COLOR_TOOLS.includes(mode);
    pill.classList.toggle("fixea-pill-hidden", !show);

    if (show) {
      const btn = document.querySelector(
        `#fixea-expanded-bar [data-tool="${mode}"]`,
      );
      if (btn) pill.style.top = `${btn.offsetTop + btn.offsetHeight / 2}px`;
    }
    pill.querySelectorAll(".fixea-color-dot").forEach((d) => {
      d.classList.toggle(
        "fixea-color-selected",
        d.dataset.color === activeColor,
      );
    });
  }

  const CURSOR_OFFSETS = {
    ticket: [12, 12],
    erase: [4, 20],
    pin: [2, 22],
    draw: [2, 22],
    highlight: [2, 22],
    arrow: [2, 2],
    blur: [12, 12],
    sticker: [4, 4],
  };

  const CURSOR_FALLBACK = {
    ticket: "crosshair",
    erase: "cell",
    pin: "crosshair",
    draw: "crosshair",
    highlight: "crosshair",
    arrow: "crosshair",
    blur: "crosshair",
    sticker: "text",
  };

  function safeCursorColor(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    return /^#[0-9a-f]{3,8}$/i.test(raw) ? raw : "#00E5FF";
  }

  function getCustomCursor(tool, color) {
    if (!tool) return "";

    const tint = tool === "erase" ? "#00E5FF" : safeCursorColor(color);
    const common =
      "xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'";

    let svg = "";

    switch (tool) {
      case "erase":
        svg = `<svg ${common} fill='white' stroke='${tint}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m7 21-4.3-4.3a1 1 0 0 1 0-1.4l13-13a1 1 0 0 1 1.4 0l4.3 4.3a1 1 0 0 1 0 1.4l-13 13a1 1 0 0 1-1.4 0z'/><path d='M22 21H7'/><path d='m5 11 9 9'/></svg>`;
        break;
      case "ticket":
        svg = `<svg ${common} fill='none' stroke-linecap='round'><path d='M12 3v18M3 12h18' stroke='#0B0C10' stroke-width='5'/><path d='M12 3v18M3 12h18' stroke='${tint}' stroke-width='2.5'/><circle cx='12' cy='12' r='2' fill='#F1F5F9' stroke='#0B0C10' stroke-width='1'/></svg>`;
        break;
      case "pin":
      case "draw":
      case "highlight":
        svg = `<svg ${common} fill='${tint}' fill-opacity='0.28' stroke='${tint}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z'/><path d='m15 5 4 4'/></svg>`;
        break;
      case "arrow":
        svg = `<svg ${common} fill='none' stroke='${tint}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M3 21 21 3'/><path d='M12 3h9v9'/></svg>`;
        break;
      case "blur":
        svg = `<svg ${common} fill='none' stroke='${tint}' stroke-width='1.5'><rect x='0.75' y='0.75' width='22.5' height='22.5' rx='2'/><path d='M6 0.75v22.5M12 0.75v22.5M18 0.75v22.5M0.75 6h22.5M0.75 12h22.5M0.75 18h22.5' stroke-opacity='0.45' stroke-width='1'/></svg>`;
        break;
      case "sticker":
        svg = `<svg ${common} fill='${tint}' fill-opacity='0.25' stroke='${tint}' stroke-width='2' stroke-linejoin='round'><path d='M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8z'/><path d='M15 3v5h5' fill='none'/></svg>`;
        break;
      default:
        return "";
    }

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function syncCursor() {
    const root = document.documentElement;
    const active = currentTool();
    const tool = active && CURSOR_OFFSETS[active] ? active : "";
    const uri = tool ? getCustomCursor(tool, activeColor) : "";
    const [offsetX, offsetY] = tool ? CURSOR_OFFSETS[tool] : [12, 12];
    const fallback = tool ? CURSOR_FALLBACK[tool] : "auto";
    const cssValue = uri
      ? `url("${uri}") ${offsetX} ${offsetY}, ${fallback}`
      : "";

    if (tool) root.setAttribute("data-fixea-cursor", tool);
    else root.removeAttribute("data-fixea-cursor");

    root.style.setProperty("--fixea-cursor", cssValue);

    const overlay = document.getElementById("fixea-overlay");
    if (overlay) overlay.style.cursor = cssValue;
  }

  function updateModeUI() {
    const root = document.documentElement;
    root.classList.toggle("fixea-drawing", isCreationTool(currentTool()));
    root.classList.toggle("fixea-erasing", mode === "erase");

    syncCursor();

    document
      .querySelectorAll("#fixea-expanded-bar [data-tool]")
      .forEach((b) => {
        const active = b.dataset.tool === mode;
        b.classList.toggle("fixea-active-icon", active);

        if (active) {
          const glow = b.dataset.tool === "erase" ? "#00E5FF" : activeColor;
          b.style.setProperty("color", glow, "important");
          b.style.setProperty(
            "filter",
            `drop-shadow(0 0 6px ${glow})`,
            "important",
          );
          b.style.setProperty("box-shadow", `0 0 12px ${glow}55`, "important");
        } else {
          b.style.removeProperty("color");
          b.style.removeProperty("filter");
          b.style.removeProperty("box-shadow");
        }
      });
    updateColorPill();
  }

  function currentTool() {
    if (mode) return mode;
    return isExpanded && environmentLinked ? DEFAULT_TOOL : null;
  }

  function gestureTypeFor(tool) {
    return tool === DEFAULT_TOOL ? "pin" : tool;
  }

  function isCreationTool(tool) {
    return tool === DEFAULT_TOOL || COLOR_TOOLS.includes(tool);
  }

  const modeListeners = new Set();

  function setMode(next) {
    if (next !== mode) cancelGesture();
    mode = next;
    updateModeUI();
    modeListeners.forEach((listener) => {
      try {
        listener(mode);
      } catch (error) {
        console.warn("Fixea: listener de modo falló", error);
      }
    });
  }

  function toggleTool(tool) {
    setMode(mode === tool ? null : tool);
  }

  function setActiveColor(color) {
    activeColor = color;
    updateModeUI();
  }

  function setExpanded(value) {
    isExpanded = value;

    if (!isExpanded) {
      cancelGesture();
      closeStatusPopover();
    }
    setMode(isExpanded ? mode : null);
    renderSavedAnnotations();
  }

  function showToast(message, tone = "default") {
    if (isDashboardPage()) return;
    const old = document.getElementById("fixea-toast");
    if (old) old.remove();
    clearTimeout(toastTimer);

    const toast = document.createElement("div");
    toast.id = "fixea-toast";
    toast.dataset.tone = tone;
    toast.textContent = message;
    document.body.appendChild(toast);

    toastTimer = setTimeout(() => toast.remove(), 3000);
  }

  function isOfflineResponse(response) {
    return Boolean(response && response.offline === true);
  }

  function removeOfflineBanner() {
    const banner = document.getElementById(OFFLINE_BANNER_ID);
    if (banner) banner.remove();
  }

  function showOfflineBanner() {
    if (isDashboardPage()) return;
    if (!document.body) return;
    if (document.getElementById(CONNECT_CARD_ID)) return;
    if (document.getElementById(OFFLINE_BANNER_ID)) return;

    const banner = document.createElement("div");
    banner.id = OFFLINE_BANNER_ID;
    banner.innerHTML = `
      <div class="fixea-offline-inner" role="status" aria-live="polite">
        <span class="fixea-offline-dot" aria-hidden="true"></span>
        <span class="fixea-offline-text">
          <strong>Servidor de Fixea desconectado</strong>
          <span>Los cambios se guardan localmente y se reintentan al reconectar.</span>
        </span>
        <button type="button" class="fixea-offline-retry" id="fixea-offline-retry">
          Reintentar
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    banner.addEventListener("click", (event) => event.stopPropagation());
    banner.addEventListener("pointerdown", (event) => event.stopPropagation());

    const retryButton = banner.querySelector("#fixea-offline-retry");

    if (retryButton) {
      retryButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        retryConnection();
      });
    }
  }

  function setServerReachable(reachable, options = {}) {
    const wasReachable = serverReachable;
    serverReachable = reachable;

    if (isDashboardPage()) return;

    if (reachable) {
      removeOfflineBanner();

      if (document.getElementById(CONNECT_CARD_ID)) {
        renderConnectCard({ offline: false });
      }

      if (!wasReachable) {
        retryPendingTickets();

        if (options.notify !== false) {
          showToast("Reconectado con Fixea");
        }
      }
      return;
    }

    if (document.getElementById(CONNECT_CARD_ID)) {
      renderConnectCard({ offline: true });
    } else {
      showOfflineBanner();
    }

    if (wasReachable && options.notify !== false) {
      showToast(OFFLINE_TOAST_MESSAGE, "error");
    }
  }

  function retryConnection() {
    if (retryInFlight) return;
    retryInFlight = true;

    const activeButton =
      document.getElementById("fixea-offline-retry") ||
      document.getElementById("fixea-connect-retry");

    if (activeButton) {
      activeButton.disabled = true;
      activeButton.textContent = "Reintentando…";
    }

    let settled = false;
    let safetyTimer = null;

    const finish = (online) => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      retryInFlight = false;

      if (activeButton) {
        activeButton.disabled = false;
        activeButton.textContent = "Reintentar";
      }

      if (online) {
        retryPendingTickets();
        refreshRemoteTickets();
        initFixeaExtension();
        return;
      }

      if (!document.getElementById(CONNECT_CARD_ID)) showOfflineBanner();
    };

    safetyTimer = setTimeout(() => finish(false), 8000);

    sendToBackground(
      {
        action: "probe_server",
        apiBase: dashboardBaseUrl.replace(/\/+$/, ""),
      },
      (response) => {
        const online = Boolean(response?.online);
        setServerReachable(online);
        finish(online);
      },
    );
  }

  function findHit(e) {
    const px = e.pageX;
    const py = e.pageY;
    if (pending && hitAnnotation(pending.ann, px, py)) return { pending: true };

    const list = allPageTickets();
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      if (hitAnnotation(normalizeAnnotation(t), px, py)) return { ticket: t };
    }
    return null;
  }

  function eraseTicket(id) {
    const key = String(id);
    const local = getTickets().find((item) => String(item.id) === key);
    const remote = allPageTickets().find(
      (item) =>
        String(item.id) === key ||
        String(item.remoteId ?? "") === key ||
        String(item._id ?? "") === key,
    );
    const ticket = local || remote;

    let remoteId = ticket ? remoteIdOf(ticket) : "";
    if (!remoteId && normalizeObjectId(key)) remoteId = key;

    if (local) removeTicket(local.id);
    removeAnnotation(key);
    if (ticket && String(ticket.id) !== key) removeAnnotation(String(ticket.id));
    expandedStickerIds.delete(key);
    remoteTickets = remoteTickets.filter(
      (item) => String(item._id ?? item.id) !== remoteId,
    );

    if (!normalizeObjectId(remoteId)) {
      showToast("Ticket eliminado", "danger");
      return;
    }

    sendDeleteToBackground(remoteId, (response) => {
      if (!response?.ok) {
        const offline = isOfflineResponse(response);

        if (offline) setServerReachable(false);

        console.warn(
          "Fixea: el ticket no se pudo borrar del servidor",
          response,
        );
        showToast(
          offline
            ? "Servidor de Fixea desconectado. Se borró en pantalla."
            : `Borrado en pantalla, pero no en el servidor: ${
                response?.error || `error ${response?.status || ""}`.trim()
              }`,
          "error",
        );
        return;
      }
      showToast("Ticket eliminado", "danger");
    });
  }

  function undoLast() {
    setMode(null);

    if (pending) {
      discardPending();
      return;
    }
    const list = pageTickets();
    const last = list[list.length - 1];
    if (!last) {
      showToast("No hay nada para deshacer");
      return;
    }
    eraseTicket(last.id);
  }

  // ---- RENDER TOOLBAR CON REACT + SHADOW DOM ----
  function buildToolbar() {
    if (isDashboardPage()) return;
    if (document.getElementById("fixea-toolbar-container")) return;
    if (!document.body) return;

    isExpanded = false;
    mode = null;
    updateModeUI();

    const toolbarContainer = document.createElement("div");
    toolbarContainer.id = "fixea-toolbar-container";
    document.body.appendChild(toolbarContainer);

    toolbarContainer.addEventListener("click", (e) => e.stopPropagation());

    const shadowRoot = toolbarContainer.attachShadow({ mode: "open" });
    const shadowContainer = document.createElement("div");
    shadowRoot.appendChild(shadowContainer);

    shadowContainer.className = "fixea-shadow-root";

    const styleElement = document.createElement("style");
    styleElement.textContent = `
      @import url('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
      :host { all: initial; }
      .fixea-shadow-root {
        color: #F1F5F9;
        color-scheme: dark;
        font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        letter-spacing: normal;
        text-transform: none;
        direction: ltr;
        visibility: inherit;
        cursor: auto;
        -webkit-font-smoothing: antialiased;
      }
      *, ::before, ::after { box-sizing: border-box; }
      button {
        appearance: none; -webkit-appearance: none;
        margin: 0; padding: 0; border: 0;
        background: none; color: inherit; font: inherit;
        line-height: 1; text-transform: none;
      }
      svg { display: block; overflow: visible; }
      .fixea-fab, .fixea-fab * { pointer-events: auto; }
      .fixea-fab { color: #F1F5F9; }
      .fixea-fab svg { color: #F1F5F9; stroke: #F1F5F9; }
      .text-\\[\\#F1F5F9\\] { color: #F1F5F9; }
      .h-full { height: 100%; }
      .h-10 { height: 2.5rem; }
      .w-10 { width: 2.5rem; }
      .h-8 { height: 2rem; }
      .h-7 { height: 1.75rem; }
      .w-7 { width: 1.75rem; }
      .max-h-\\[calc\\(100vh-2rem\\)\\] { max-height: calc(100vh - 2rem); }
      .p-0 { padding: 0; }
      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; }
      .border-0 { border-width: 0; }
      .bg-transparent { background-color: transparent; }
      .bg-\\[\\#F1F5F9\\]\\/50 { background-color: rgba(241, 245, 249, 0.5); }
      .shrink-0 { flex-shrink: 0; }
      .overflow-visible { overflow: visible; }
      .z-\\[80\\] { z-index: 80; }
      .shadow-\\[0px_5px_4px_rgba\\(30\\2c 30\\2c 30\\2c 0\\.50\\)\\] { box-shadow: 0px 5px 4px rgba(30, 30, 30, 0.5); }
      .transition-transform { transition-property: transform; transition-duration: 150ms; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
      .focus\\:outline-none:focus { outline: none; }
      .hover\\:scale-105:hover { transform: scale(1.05); }
      .hover\\:scale-110:hover { transform: scale(1.1); }
      .active\\:scale-95:active { transform: scale(0.95); }
      .fixea-fab:focus-visible { outline: 2px solid #00E5FF; outline-offset: 3px; }
      .fixed { position: fixed; }
      .bottom-6 { bottom: 1.5rem; }
      .right-6 { right: 1.5rem; }
      .right-\\[32px\\] { right: 32px; }
      .z-\\[70\\] { z-index: 70; }
      .flex { display: flex; }
      .flex-col { flex-direction: column; }
      .items-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .justify-center { justify-content: center; }
      .w-\\[76px\\] { width: 76px; }
      .h-\\[592px\\] { height: 592px; }
      .w-\\[60px\\] { width: 60px; }
      .h-\\[60px\\] { height: 60px; }
      .rounded-\\[23px\\] { border-radius: 23px; }
      .rounded-\\[16px\\] { border-radius: 16px; }
      .bg-\\[\\#0B0C10\\] { background-color: #0B0C10; }
      .w-full { width: 100%; }
      .h-\\[0\\.5px\\] { height: 0.5px; }
      .cursor-pointer { cursor: pointer; }
      .transition-all { transition-property: all; }
      .duration-300 { transition-duration: 300ms; }
      .ease-out { transition-timing-function: cubic-bezier(0, 0, 0.2, 1); }
      .pointer-events-auto { pointer-events: auto; }
      .pointer-events-none { pointer-events: none; }
      .opacity-100 { opacity: 1; }
      .opacity-0 { opacity: 0; }
      .scale-100 { transform: scale(1); }
      .scale-95 { transform: scale(0.95); }
      .translate-y-0 { transform: translateY(0); }
      .translate-y-4 { transform: translateY(1rem); }
      .visible { visibility: visible; }
      .invisible { visibility: hidden; }
      .relative { position: relative; }
      .absolute { position: absolute; }
      .right-\\[calc\\(100\\%\\+14px\\)\\] { right: calc(100% + 14px); }
      .top-1\\/2 { top: 50%; }
      .-translate-y-1\\/2 { transform: translateY(-50%); }
    `;
    shadowRoot.appendChild(styleElement);

    const ToolbarWrapper = () => {
      const [currentTool, setCurrentTool] = React.useState(mode);
      const [currentColor, setCurrentColor] = React.useState(activeColor);

      React.useEffect(() => {
        const listener = (next) => setCurrentTool(next);
        modeListeners.add(listener);
        return () => modeListeners.delete(listener);
      }, []);

      const handleToolSelect = React.useCallback((tool) => {
        setMode(tool || null);
      }, []);

      const handleUndo = React.useCallback(() => undoLast(), []);

      const handleColorSelect = React.useCallback((color) => {
        setCurrentColor(color);
        setActiveColor(color);
      }, []);

      const handleExpandedChange = React.useCallback((expanded) => {
        if (expanded !== isExpanded) setExpanded(expanded);
      }, []);

      return (
        <ClientToolbar
          activeTool={currentTool}
          setActiveTool={handleToolSelect}
          activeColor={currentColor}
          onColorChange={handleColorSelect}
          onExpandedChange={handleExpandedChange}
          onUndo={handleUndo}
          manageBodyCursor={false}
        />
      );
    };

    const root = ReactDOM.createRoot(shadowContainer);
    root.render(<ToolbarWrapper />);

    renderSavedAnnotations();
    retryPendingTickets();
    refreshRemoteTickets();
    startRemoteRefresh();
  }

  function persistMatchedProject(project) {
    const id = normalizeObjectId(project?.id || project?._id);
    if (!id || !hasExtensionContext() || !chrome.storage?.local) return;

    const entry = {
      id,
      name: typeof project.name === "string" ? project.name : "",
      targetUrl: typeof project.targetUrl === "string" ? project.targetUrl : "",
      recipient: recipientLabelFromMembers(project?.members),
    };

    readLocalSettings(
      [
        "fixea_projects",
        "fixea_project_id",
        "fixea_project",
        "fixea_project_target_url",
        "fixea_project_recipient",
      ],
      (settings) => {
        const projects = parseProjectList(settings?.fixea_projects);
        const index = projects.findIndex(
          (item) => String(item.id ?? item._id ?? "") === id,
        );
        const existing = index >= 0 ? projects[index] : null;
        const nextProjects = projects.slice();

        if (index >= 0) nextProjects[index] = { ...existing, ...entry };
        else nextProjects.push(entry);

        const sameProject =
          existing &&
          existing.name === entry.name &&
          existing.targetUrl === entry.targetUrl &&
          (existing.recipient || "") === entry.recipient;
        const sameSelection =
          String(settings?.fixea_project_id || "") === id &&
          String(settings?.fixea_project || "") === entry.name &&
          String(settings?.fixea_project_target_url || "") === entry.targetUrl &&
          String(settings?.fixea_project_recipient || "") === entry.recipient;

        if (sameProject && sameSelection) return;

        suppressStorageReinitUntil = Date.now() + 1500;

        try {
          chrome.storage.local.set({
            fixea_projects: nextProjects,
            fixea_project_id: id,
            fixea_project: entry.name,
            fixea_project_target_url: entry.targetUrl,
            fixea_project_recipient: entry.recipient,
          });
        } catch (error) {
          warnContextInvalidated(error);
        }
      },
    );
  }

  function sameText(a, b) {
    const left = String(a || "").trim().toLowerCase();
    const right = String(b || "").trim().toLowerCase();
    return Boolean(left) && left === right;
  }

  function isCurrentReporter(member) {
    const me = reporterIdentity;
    return (
      (member?.id && me.userId && String(member.id) === String(me.userId)) ||
      sameText(member?.email, me.email) ||
      sameText(member?.name, me.name)
    );
  }

  function updateProjectPeople(members) {
    const list = Array.isArray(members) ? members.filter(Boolean) : [];
    const label = (member) =>
      String(member?.name || member?.email || "").trim();
    const client = list.find(
      (member) => normalizeRole(member.role) === "client" && label(member),
    );

    projectDeveloperNames = list
      .filter((member) => isDeveloperRole(member.role))
      .flatMap((member) => [member.name, member.email])
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    const nextClient = client ? label(client) : "";
    if (nextClient === projectClientName) return;
    projectClientName = nextClient;

    try {
      if (hasExtensionContext() && chrome.storage?.local) {
        chrome.storage.local.set({ fixea_project_client_name: nextClient });
      }
    } catch (error) {
      warnContextInvalidated(error);
    }
  }

  function resolveReporterName(settings) {
    const session = settings?.fixea_session || {};
    const role = normalizeRole(settings?.fixea_role || session.role);
    const stored = String(settings?.fixea_author || "").trim();
    const sessionName = String(session.author || "").trim();
    const clientName =
      projectClientName ||
      String(settings?.fixea_project_client_name || "").trim();
    const storedIsDeveloper =
      !!stored &&
      (projectDeveloperNames.some((name) => sameText(name, stored)) ||
        (role === "developer" && sameText(stored, sessionName)));

    if (clientName && (role === "developer" || !stored || storedIsDeveloper)) {
      return clientName;
    }
    return storedIsDeveloper ? "" : stored;
  }

  function recipientLabelFromMembers(members) {
    const list = Array.isArray(members)
      ? members.filter(
          (member) =>
            member && (member.name || member.email) && !isCurrentReporter(member),
        )
      : [];
    const dev = list.find((member) => isDeveloperRole(member.role));
    const chosen =
      dev || list.find((member) => normalizeRole(member.role) !== "client");

    if (!chosen) return RECIPIENT_FALLBACK;

    const name = String(chosen.name || chosen.email || "").trim();
    return name || RECIPIENT_FALLBACK;
  }

  function safeRecipientLabel(value, authorName = "") {
    const label = String(value || "").trim();
    if (!label || label === "Equipo del proyecto") return RECIPIENT_FALLBACK;
    if (
      sameText(label, reporterIdentity.name) ||
      sameText(label, reporterIdentity.email) ||
      sameText(label, authorName)
    ) {
      return RECIPIENT_FALLBACK;
    }
    return label;
  }

  function linkMatchedProject(project, callback) {
    const id = normalizeObjectId(project?.id || project?._id);
    updateProjectPeople(project?.members);

    if (!id) {
      callback(null);
      return;
    }

    persistMatchedProject(project);

    readCachedEnvironment((env) => {
      const projects = Array.isArray(env.projects) ? env.projects.slice() : [];
      const recipient = recipientLabelFromMembers(project?.members);
      const entry = {
        id,
        name: typeof project.name === "string" ? project.name : "",
        targetUrl:
          typeof project.targetUrl === "string" ? project.targetUrl : "",
        recipient,
      };
      const index = projects.findIndex(
        (item) => String(item.id ?? item._id ?? "") === id,
      );

      if (index >= 0) projects[index] = { ...projects[index], ...entry };
      else projects.push(entry);

      callback({
        ...env,
        projectId: id,
        projectName: entry.name || env.projectName,
        targetUrl: entry.targetUrl || env.targetUrl,
        recipient,
        projects,
      });
    });
  }

  function mountProjectEnvironment(env) {
    if (isDashboardPage()) return false;
    if (!env?.projectId) return false;

    linkedProjectId = String(env.projectId || "");
    linkedRecipient = safeRecipientLabel(
      String(env.recipient || "").trim() || linkedRecipient,
    );
    environmentLinked = true;
    removeConnectCard();

    if (!serverReachable) showOfflineBanner();

    if (document.getElementById("fixea-toolbar-container")) {
      renderSavedAnnotations();
      refreshRemoteTickets();
      return true;
    }

    buildToolbar();
    return true;
  }

  function unmountProjectEnvironment() {
    environmentLinked = false;
    linkedProjectId = "";
    isExpanded = false;
    cancelGesture();
    setMode(null);

    const toolbar = document.getElementById("fixea-toolbar-container");
    if (toolbar) toolbar.remove();

    stopRemoteRefresh();
    remoteTickets = [];
    clearRenderedAnnotations();
    removeConnectCard();
    removeOfflineBanner();
  }

  const MATCH_RETRY_DELAYS_MS = [2000, 5000, 10000, 20000];
  let matchRetryTimer = null;
  let matchRetryCount = 0;

  function scheduleMatchRetry(reason) {
    if (matchRetryTimer) return;
    if (matchRetryCount >= MATCH_RETRY_DELAYS_MS.length) {
      log(`backend sin respuesta tras ${matchRetryCount} reintentos (${reason}).`);
      return;
    }

    const delay = MATCH_RETRY_DELAYS_MS[matchRetryCount];
    matchRetryCount += 1;
    log(`backend sin respuesta (${reason}); reintento ${matchRetryCount} en ${delay} ms`);
    matchRetryTimer = setTimeout(() => {
      matchRetryTimer = null;
      initFixeaExtension({ isRetry: true });
    }, delay);
  }

  function initFixeaExtension(options = {}) {
    if (isDashboardPage()) return;
    if (!document.body) return;

    if (!options.isRetry) {
      matchRetryCount = 0;
      if (matchRetryTimer) {
        clearTimeout(matchRetryTimer);
        matchRetryTimer = null;
      }
    }

    const pageOrigin = location.origin;
    const requestId = ++matchRequestId;

    readCachedEnvironment((env) => {
      sendToBackground(
        { action: "match_project", origin: pageOrigin },
        (response) => {
          if (requestId !== matchRequestId) return;

          if (response?.offline === true) {
            if (canAnnotate(env)) {
              if (recoverSpaRoute404()) return;
              setServerReachable(false, { notify: false });
              mountProjectEnvironment(env);
            }
            scheduleMatchRetry(`offline contra ${response?.apiBase || "API"}`);
            return;
          }

          if (!response || response.ok !== true || typeof response.match !== "boolean") {
            log("respuesta de match no concluyente:", response);
            scheduleMatchRetry(response?.error || `status ${response?.status}`);
            return;
          }

          matchRetryCount = 0;
          if (!serverReachable) setServerReachable(true, { notify: false });

          if (!response.match) {
            log(
              `${pageOrigin} no coincide con ningún proyecto activo. ` +
                "Revisá la URL objetivo del proyecto en el Dashboard.",
            );
            unmountProjectEnvironment();
            return;
          }

          log(`proyecto "${response.project?.name}" registrado para ${pageOrigin}`);

          if (recoverSpaRoute404()) return;

          linkMatchedProject(response.project, (nextEnv) => {
            if (requestId !== matchRequestId) return;
            mountProjectEnvironment(nextEnv);
          });
        },
      );
    });
  }

  // ---- Mensajes desde popup / background ----
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "fixea_show_card") {
        if (isDashboardPage()) {
          sendResponse({ ok: false, reason: "dashboard" });
          return false;
        }

        if (
          environmentLinked &&
          document.getElementById("fixea-toolbar-container")
        ) {
          sendResponse({ ok: true, mode: "toolbar" });
          return false;
        }

        readCachedEnvironment((env) => {
          sendToBackground(
            { action: "match_project", origin: location.origin },
            (response) => {
              if (response?.ok === true && response.match === true) {
                if (recoverSpaRoute404()) {
                  sendResponse({ ok: true, mode: "recovering_404" });
                  return;
                }

                linkMatchedProject(response.project, (nextEnv) => {
                  mountProjectEnvironment(nextEnv);
                  sendResponse({ ok: true, mode: "toolbar" });
                });
                return;
              }

              if (response?.offline === true && canAnnotate(env)) {
                setServerReachable(false, { notify: false });
                mountProjectEnvironment(env);
                sendResponse({ ok: true, mode: "toolbar", offline: true });
                return;
              }

              const offline = response?.offline === true;
              if (offline) {
                setServerReachable(false, { notify: false });
                matchRetryCount = 0;
                scheduleMatchRetry("clic en el ícono sin backend");
              }
              renderConnectCard({ offline });
              sendResponse({ ok: true, mode: "card", offline });
            },
          );
        });

        return true;
      }

      if (request.action === "toggle_pinning") {
        if (isDashboardPage()) {
          sendResponse({ active: false });
          return false;
        }

        readCachedEnvironment((env) => {
          if (!canAnnotate(env)) {
            environmentLinked = false;
            linkedProjectId = "";
            const toolbar = document.getElementById("fixea-toolbar-container");
            if (toolbar) toolbar.remove();
            stopRemoteRefresh();
            remoteTickets = [];
            clearRenderedAnnotations();
            renderConnectCard({ offline: !serverReachable });
            sendResponse({ active: false, needsSetup: true });
            return;
          }

          linkedProjectId = String(env.projectId || "");
          environmentLinked = true;
          removeConnectCard();
          if (!serverReachable) showOfflineBanner();
          buildToolbar();
          setMode("pin");
          sendResponse({ active: mode === "pin" });
        });

        return true;
      }

      if (request.action === "fixea_refresh_environment") {
        if (!isDashboardPage()) initFixeaExtension();

        sendResponse({ ok: true });
        return false;
      }

      if (request.action === "fixea_get_env") {
        getEnvironment((env) => {
          sendResponse({ ok: true, env: env || null });
        });
        return true;
      }

      if (request.action === "fixea_tickets_changed") {
        if (isDashboardPage()) {
          try {
            const eventName = location.pathname.startsWith("/cliente")
              ? "fixea:tickets-updated"
              : "fixea:tickets-changed";

            window.dispatchEvent(new CustomEvent(eventName));
          } catch (error) {
            console.warn("Fixea: no se pudo notificar a la web", error);
          }
        }
        sendResponse({ ok: true });
        return false;
      }

      return false;
    });
  } catch (error) {
    warnContextInvalidated(error);
  }

  // ---- Gestos de dibujo ----
  document.addEventListener(
    "pointerdown",
    (e) => {
      const tool = currentTool();
      if (!isCreationTool(tool) || e.button !== 0 || isUI(e.target)) return;

      e.preventDefault();
      e.stopPropagation();
      discardPending();

      const x = Math.round(e.pageX);
      const y = Math.round(e.pageY);
      gesture = {
        id: Date.now(),
        type: gestureTypeFor(tool),
        color: activeColor,
        x0: x,
        y0: y,
        x,
        y,
        points: [[x, y]],
        dragging: false,
        straight: e.shiftKey === true,
        targetRect: pageRectOf(e.target),
        metadata: captureDomMetadata(e.target),
      };
    },
    true,
  );

  document.addEventListener(
    "pointermove",
    (e) => {
      if (!gesture) return;

      gesture.x = Math.round(e.pageX);
      gesture.y = Math.round(e.pageY);
      gesture.straight = e.shiftKey === true;

      if (
        !gesture.dragging &&
        Math.hypot(gesture.x - gesture.x0, gesture.y - gesture.y0) >= MIN_DRAG
      ) {
        gesture.dragging = true;
      }
      if (FREEHAND_TOOLS.includes(gesture.type)) {
        const last = gesture.points[gesture.points.length - 1];
        if (Math.hypot(gesture.x - last[0], gesture.y - last[1]) >= 3) {
          gesture.points.push([gesture.x, gesture.y]);
        }
      }
      if (DRAG_TOOLS.includes(gesture.type) && gesture.dragging) {
        const previewAnn = buildAnnotation(gesture);
        createBlurBox(previewAnn);
        drawShape(previewAnn);
      }
    },
    true,
  );

  function previewGesture() {
    if (!gesture || !gesture.dragging) return;
    if (!DRAG_TOOLS.includes(gesture.type)) return;
    const previewAnn = buildAnnotation(gesture);
    createBlurBox(previewAnn);
    drawShape(previewAnn);
  }

  ["keydown", "keyup"].forEach((type) => {
    document.addEventListener(
      type,
      (e) => {
        if (e.key !== "Shift" || !gesture) return;
        if (!FREEHAND_TOOLS.includes(gesture.type)) return;
        gesture.straight = type === "keydown";
        previewGesture();
      },
      true,
    );
  });

  document.addEventListener(
    "pointerup",
    (e) => {
      if (!gesture) return;
      e.preventDefault();
      e.stopPropagation();

      const g = gesture;
      gesture = null;
      suppressClickUntil = performance.now() + 400;
      g.x = Math.round(e.pageX);
      g.y = Math.round(e.pageY);
      g.straight = e.shiftKey === true;

      removeAnnotation(g.id);
      const ann = buildAnnotation(g);
      const number = nextTicketNumber();

      if (ann.type !== "sticker") renderAnnotation(ann);
      createModalElement(ann, number, { x: g.x, y: g.y });
      setMode(null);
    },
    true,
  );

  document.addEventListener("pointercancel", cancelGesture, true);

  document.addEventListener(
    "click",
    (e) => {
      if (isUI(e.target)) return;

      if (mode === "erase") {
        e.preventDefault();
        e.stopPropagation();

        const hit = findHit(e);
        if (!hit) return;
        if (hit.pending) discardPending();
        else eraseTicket(hit.ticket.id);
        return;
      }

      if (
        performance.now() < suppressClickUntil ||
        isCreationTool(currentTool())
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (statusPopoverEl) closeStatusPopover();

    const openModal = document.getElementById("fixea-modal");
    if (openModal) {
      if (pending && pending.modalEl === openModal) discardPending();
      else openModal.remove();
    }

    if (mode || gesture) {
      cancelGesture();
      setMode(null);
    }
  });

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!statusPopoverEl || !(e.target instanceof Element)) return;
      if (e.target.closest("#fixea-status-popover")) return;
      if (e.target.closest(".fixea-pin-badge")) return;
      closeStatusPopover();
    },
    true,
  );

  // ---- Modal de ticket ----
  const PRIORITIES = [
    { value: "Alta", color: "#FF003C" },
    { value: "Media", color: "#FFEA00" },
    { value: "Baja", color: "#00FF66" },
  ];

  const LOGO_URL = (() => {
    try {
      return chrome?.runtime?.getURL
        ? chrome.runtime.getURL("icons/fixea-logo.png")
        : "icons/fixea-logo.png";
    } catch (error) {
      return "icons/fixea-logo.png";
    }
  })();
  const CLOSE_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;
  const CHEVRON_SVG = `<svg class="fixea-priority-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>`;
  const BULB_SVG = `<svg class="fixea-status-bulb" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6l.1.6h5.2l.1-.6c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3Z" stroke="#FFD600" stroke-width="1.7" stroke-linejoin="round" fill="rgba(255,214,0,0.12)"/><path d="M9.5 18h5M10.5 21h3M12 6.5v4.2" stroke="#FFD600" stroke-width="1.7" stroke-linecap="round"/></svg>`;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }

  function statusLabel(status) {
    return status === "EN_PROCESO" ? "EN PROCESO" : status;
  }

  function revealArrowShape(ann) {
    if (!ann || ann.type !== "arrow") return;
    revealedShapeIds.add(String(ann.id));
    drawShape(normalizeAnnotation(ann));
  }

  function hideArrowShape(ann) {
    if (!ann || ann.type !== "arrow") return;
    revealedShapeIds.delete(String(ann.id));
    const overlay = document.getElementById("fixea-overlay");
    const shape = overlay?.querySelector(`[data-fixea-id="${ann.id}"]`);
    if (shape) shape.remove();
  }

  function closeStatusPopover() {
    if (!statusPopoverEl) return;
    hideArrowShape(statusPopoverAnn);
    statusPopoverEl.remove();
    statusPopoverEl = null;
    statusPopoverAnn = null;
    if (annotationsDirty) renderSavedAnnotations();
  }

  function positionStatusPopover(el, ann) {
    const WIDTH = 260;

    if (!ann?.coords) return;

    const height = el.offsetHeight || 230;
    const minLeft = window.scrollX + 12;
    const maxLeft = window.scrollX + window.innerWidth - WIDTH - 12;
    const preferredLeft = ann.coords.x + 28;
    const maxTop = window.scrollY + window.innerHeight - height - 12;

    el.style.left = `${Math.max(Math.min(preferredLeft, maxLeft), minLeft)}px`;
    el.style.top = `${Math.max(
      Math.min(ann.coords.y - 24, maxTop),
      window.scrollY + 12,
    )}px`;
  }

  function statusPopoverMarkup(ann, status) {
    const color = STATUS_STYLES[status].color;
    const canVerify = status === "EN_PROCESO" && !!remoteIdOf(ann);

    let footer = "";

    if (canVerify) {
      footer = `
        <div class="fixea-status-actions">
          <button type="button" data-action="approve" class="fixea-status-btn fixea-status-approve">
            Aprobar corrección
          </button>
          <button type="button" data-action="reject" class="fixea-status-btn fixea-status-reject">
            Sigue roto
          </button>
        </div>`;
    } else if (status === "FINALIZADO") {
      footer = `<p class="fixea-status-note fixea-status-ok">Corrección verificada por el cliente.</p>`;
    } else if (status === "EN_PROCESO") {
      footer = `<p class="fixea-status-note">Sincronizá el ticket para poder verificarlo.</p>`;
    } else {
      footer = `<p class="fixea-status-note">El programador todavía no tomó este reporte.</p>`;
    }

    return `
      <div class="fixea-status-head">
        <span class="fixea-status-pill" style="--fixea-status-c:${color}">
          ${escapeHtml(statusLabel(status))}
        </span>
        <button type="button" class="fixea-status-close" aria-label="Cerrar estado">
          ${CLOSE_SVG}
        </button>
      </div>

      <div class="fixea-status-title-row">
        ${BULB_SVG}
        <p class="fixea-status-title">"${escapeHtml(ann.title || "Sin descripción")}"</p>
      </div>

      <div class="fixea-status-devnote">
        <span>Solución aplicada</span>
        <p>${escapeHtml(ann.devNote || "El equipo todavía no dejó una nota técnica.")}</p>
      </div>

      ${footer}
    `;
  }

  function openStatusPopover(ann, badge) {
    closeStatusPopover();

    if (!ann) return;

    const status = statusOf(ann);
    const popover = document.createElement("div");
    popover.id = "fixea-status-popover";
    popover.className = "fixea-status-popover";
    popover.dataset.fixeaStatus = status;
    popover.innerHTML = statusPopoverMarkup(ann, status);

    popover
      .querySelector(".fixea-status-close")
      .addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        closeStatusPopover();
      });

    popover.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const nextStatus =
          button.dataset.action === "approve" ? "FINALIZADO" : "PENDIENTE";
        verifyTicket(ann, nextStatus, popover);
      });
    });

    document.body.appendChild(popover);
    statusPopoverEl = popover;
    statusPopoverAnn = ann;
    positionStatusPopover(popover, ann);
    revealArrowShape(ann);

    if (badge) badge.setAttribute("aria-expanded", "true");
  }

  function verifyTicket(ann, nextStatus, popover) {
    const remoteId = remoteIdOf(ann);

    if (!remoteId) {
      showToast("El ticket todavía no está sincronizado");
      return;
    }

    const buttons = popover.querySelectorAll("[data-action]");
    buttons.forEach((button) => {
      button.disabled = true;
    });

    sendToBackground(
      {
        action: "update_ticket_status",
        remoteId,
        status: nextStatus,
        projectId: linkedProjectId,
        verifiedByName: currentReporterName || projectClientName || "",
      },
      (response) => {
        if (!response?.ok) {
          buttons.forEach((button) => {
            button.disabled = false;
          });

          const offline = isOfflineResponse(response);

          if (offline) setServerReachable(false);

          showToast(
            offline
              ? "Servidor de Fixea desconectado. No se pudo actualizar el ticket."
              : response?.error || "No se pudo actualizar el ticket",
            offline ? "error" : "default",
          );
          return;
        }

        const updated = response?.data?.ticket || {};

        ann.status = nextStatus;
        if (updated.devNote !== undefined) ann.devNote = updated.devNote;
        if (ann.remoteId === undefined) ann.remoteId = remoteId;

        patchLocalTicketStatus(remoteId, nextStatus, updated.devNote);

        remoteTickets = remoteTickets.map((ticket) =>
          String(ticket._id ?? ticket.id) === remoteId
            ? {
                ...ticket,
                status: nextStatus,
                devNote: updated.devNote ?? ticket.devNote,
              }
            : ticket,
        );

        refreshBadgeStatus(ann.id, nextStatus);
        closeStatusPopover();
        if (ann.type === "sticker") renderSavedAnnotations();

        if (nextStatus === "FINALIZADO") {
          showToast("Fix aprobado correctamente", "success");
        } else {
          showToast("Ticket devuelto a pendientes");
        }
      },
    );
  }

  function createModalElement(ann, number, at) {
    discardPending();

    const MODAL_WIDTH = 340;
    const TOOLBAR_RESERVE = 104;
    const modal = document.createElement("div");
    modal.id = "fixea-modal";
    modal.className = "fixea-floating-modal";

    const minLeft = window.scrollX + 12;
    const maxLeft =
      window.scrollX + window.innerWidth - MODAL_WIDTH - TOOLBAR_RESERVE;
    const preferredLeft =
      at.x - MODAL_WIDTH - 20 >= minLeft ? at.x - MODAL_WIDTH - 20 : at.x + 20;

    modal.style.left = `${Math.max(Math.min(preferredLeft, maxLeft), minLeft)}px`;
    modal.style.top = `${Math.max(at.y - 60, window.scrollY + 12)}px`;

    modal.innerHTML = `
      <div class="fixea-modal-inner">
        <div class="fixea-modal-header">
          <div class="fixea-modal-title">
            <span class="fixea-modal-mark" aria-hidden="true">${fixeaMarkSvg()}</span>
            <span class="fixea-modal-heading">Nueva corrección</span>
          </div>
          <button type="button" id="fixea-close-btn" class="fixea-close-btn" title="Cerrar reporte" aria-label="Cerrar reporte">
            ${CLOSE_SVG}
          </button>
        </div>

        <div class="fixea-author-row">
          <div class="fixea-avatar" id="fixea-author-avatar">C</div>
          <div class="fixea-author-field">
            <input id="fixea-author-input" class="fixea-author-input" type="text" maxlength="40" value="" placeholder="Tu nombre" aria-label="Nombre del cliente" />
            <p class="fixea-author-hint fixea-recipient" id="fixea-recipient">Para: ${escapeHtml(safeRecipientLabel(linkedRecipient))}</p>
          </div>
        </div>

        <textarea id="fixea-ticket-text" rows="3" maxlength="500" placeholder="Cambiá el texto..." aria-label="Descripción del reporte"></textarea>

        <div class="fixea-modal-footer">
          <div class="fixea-priority-wrap">
            <button type="button" id="fixea-priority-field" class="fixea-priority" aria-haspopup="listbox" aria-expanded="false" aria-label="Prioridad del ticket">
              <span class="fixea-priority-dot" id="fixea-priority-dot"></span>
              <span>Prioridad</span>
              <span class="fixea-priority-value" id="fixea-priority-value">Alta</span>
              ${CHEVRON_SVG}
            </button>
            <div class="fixea-priority-menu" id="fixea-priority-menu" role="listbox" aria-label="Prioridad del ticket">
              ${PRIORITIES.map(
                (option) => `
                  <button type="button" class="fixea-priority-option" role="option" data-value="${option.value}" aria-selected="${option.value === PRIORITIES[0].value ? "true" : "false"}">
                    <span class="fixea-priority-option-dot" style="background:${option.color};box-shadow:0 0 8px ${option.color}"></span>
                    <span>${option.value}</span>
                  </button>
                `,
              ).join("")}
            </div>
          </div>

          <button type="button" id="fixea-send-btn" class="fixea-send-btn" title="Enviar ticket" aria-label="Enviar ticket">
            <span>CREAR TICKET</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    pending = { ann, modalEl: modal };

    const titleInput = modal.querySelector("#fixea-ticket-text");
    const authorInput = modal.querySelector("#fixea-author-input");
    const authorAvatar = modal.querySelector("#fixea-author-avatar");
    const priorityField = modal.querySelector("#fixea-priority-field");
    const priorityMenu = modal.querySelector("#fixea-priority-menu");
    const priorityDot = modal.querySelector("#fixea-priority-dot");
    const priorityValue = modal.querySelector("#fixea-priority-value");
    const sendBtn = modal.querySelector("#fixea-send-btn");
    let selectedPriority = PRIORITIES[0].value;

    readLocalSettings(
      ["fixea_author", "fixea_session", "fixea_role", "fixea_project_client_name"],
      (settings) => {
      const stored = resolveReporterName(settings);
      if (!stored || authorInput.value) return;
      authorInput.value = stored;
      syncAvatar();
      },
    );

    const setPriorityMenuOpen = (open) => {
      priorityMenu.dataset.open = open ? "true" : "false";
      priorityField.setAttribute("aria-expanded", open ? "true" : "false");
      priorityField.classList.toggle("fixea-priority-open", open);
    };

    const syncPriority = () => {
      const selected =
        PRIORITIES.find((option) => option.value === selectedPriority) ||
        PRIORITIES[0];
      priorityDot.style.backgroundColor = selected.color;
      priorityDot.style.boxShadow = `0 0 8px ${selected.color}`;
      priorityValue.style.color = selected.color;
      priorityValue.textContent = selected.value;
      priorityMenu
        .querySelectorAll(".fixea-priority-option")
        .forEach((option) => {
          const active = option.dataset.value === selected.value;
          option.setAttribute("aria-selected", active ? "true" : "false");
          option.classList.toggle("fixea-priority-option-active", active);
        });
    };

    const closePriorityMenuOnOutside = (event) => {
      if (!modal.isConnected) {
        document.removeEventListener("pointerdown", closePriorityMenuOnOutside, true);
        return;
      }
      if (
        event.target.closest("#fixea-priority-field") ||
        event.target.closest("#fixea-priority-menu")
      ) {
        return;
      }
      setPriorityMenuOpen(false);
    };

    const recipientEl = modal.querySelector("#fixea-recipient");

    const syncAvatar = () => {
      const initial = (authorInput.value.trim() || "C").charAt(0).toUpperCase();
      authorAvatar.textContent = initial;
      if (recipientEl) {
        recipientEl.textContent = `Para: ${safeRecipientLabel(
          linkedRecipient,
          authorInput.value,
        )}`;
      }
    };

    priorityField.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setPriorityMenuOpen(priorityMenu.dataset.open !== "true");
    });
    priorityField.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setPriorityMenuOpen(priorityMenu.dataset.open !== "true");
      }
      if (event.key === "Escape") setPriorityMenuOpen(false);
    });
    priorityMenu.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const option = event.target.closest(".fixea-priority-option");
      if (!option) return;
      selectedPriority = option.dataset.value || PRIORITIES[0].value;
      syncPriority();
      setPriorityMenuOpen(false);
    });
    document.addEventListener("pointerdown", closePriorityMenuOnOutside, true);

    authorInput.addEventListener("input", syncAvatar);
    syncPriority();
    syncAvatar();

    const fitInViewport = () => {
      if (!modal.isConnected) return;
      const height = modal.offsetHeight || 0;
      const maxTop = window.scrollY + window.innerHeight - height - 12;
      const top = parseFloat(modal.style.top) || 0;
      if (top > maxTop) {
        modal.style.top = `${Math.max(maxTop, window.scrollY + 12)}px`;
      }
    };
    requestAnimationFrame(fitInViewport);

    setTimeout(() => {
      fitInViewport();
      if (titleInput) titleInput.focus({ preventScroll: true });
    }, 100);

    modal.querySelector("#fixea-close-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (pending && pending.modalEl === modal) discardPending();
      else modal.remove();
    });

    sendBtn.addEventListener("click", () => {
      const titleText = titleInput.value.trim();
      if (!titleText) {
        titleInput.focus();
        return;
      }

      const author = authorInput.value.trim() || "Cliente";
      const priority = selectedPriority;
      const ticketNumber = nextTicketNumber();

      const ticket = {
        id: ann.id,
        number: ticketNumber,
        type: ann.type,
        color: ann.color,
        shape: ann.shape,
        project: location.hostname,
        title: titleText,
        priority,
        status: "PENDIENTE",
        author,
        coords: ann.coords,
        metadata: ann.metadata || null,
        url: pageKey(),
        createdAt: new Date().toISOString(),
        synced: false,
      };

      try {
        if (hasExtensionContext() && chrome.storage?.local) {
          chrome.storage.local.set({ fixea_author: author });
          currentReporterName = author;
        }
      } catch (error) {
        warnContextInvalidated(error);
      }

      saveTicket(ticket);

      ann.title = titleText;
      const isSticker = ann.type === "sticker";
      pending = null;

      const label = sendBtn.querySelector("span");
      sendBtn.disabled = true;
      sendBtn.classList.add("fixea-is-loading");
      if (label) label.textContent = "ENVIANDO…";

      syncTicket(ticket, {
        onDone: (ok) => {
          sendBtn.classList.remove("fixea-is-loading");
          if (label) label.textContent = ok ? "¡ENVIADO!" : "GUARDADO LOCAL";
          setTimeout(() => {
            modal.remove();
            if (isSticker || annotationsDirty) renderSavedAnnotations();
          }, ok ? 800 : 1600);
        },
      });
    });
  }

  // ---- Arranque ----
  if (isDashboardPage()) {
    log("Dashboard de FIXEA detectado: modo pasivo (sin toolbar ni overlay).");

    const MIN_SYNC_GAP_MS = 1000;
    const VISIBILITY_SYNC_GAP_MS = 30000;
    let syncInFlight = null;
    let lastSyncAt = 0;
    let stopped = false;

    const notifySyncDone = () => {
      try {
        window.dispatchEvent(new CustomEvent("fixea:environment-sync-done"));
      } catch (error) {}
    };

    const syncPassively = (minGap = MIN_SYNC_GAP_MS) => {
      if (stopped) return Promise.resolve();
      if (!hasExtensionContext()) {
        stopDashboardSync();
        return Promise.resolve();
      }
      if (syncInFlight) return syncInFlight;
      if (Date.now() - lastSyncAt < minGap) return Promise.resolve();

      lastSyncAt = Date.now();
      syncInFlight = resolveDashboardEnvironment()
        .catch(() => {})
        .finally(() => {
          syncInFlight = null;
        });
      return syncInFlight;
    };

    const onPageSyncRequest = () => {
      syncPassively().finally(notifySyncDone);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncPassively(VISIBILITY_SYNC_GAP_MS);
      }
    };

    const stopDashboardSync = () => {
      stopped = true;
      window.removeEventListener("fixea:environment-synced", onPageSyncRequest);
      document.removeEventListener("visibilitychange", onVisibility);
    };

    window.addEventListener("fixea:environment-synced", onPageSyncRequest);
    document.addEventListener("visibilitychange", onVisibility);

    const firstSync = () => {
      const run = () => syncPassively(0);
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(run, { timeout: 3000 });
      } else {
        setTimeout(run, 500);
      }
    };

    if (document.readyState === "complete") firstSync();
    else window.addEventListener("load", firstSync, { once: true });
  } else {
    try {
      if (chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area !== "local") return;
          if (Date.now() < suppressStorageReinitUntil) return;

          const relevantKeys = [
            "fixea_project_id",
            "fixea_project",
            "fixea_project_target_url",
            "fixea_projects",
            "fixea_session",
          ];

          if (relevantKeys.some((key) => key in changes)) {
            setTimeout(initFixeaExtension, 75);
          }
        });
      }
    } catch (error) {
      warnContextInvalidated(error);
    }

    let lastSpaUrl = location.href;
    let spaSyncTimer = null;

    const scheduleSpaSync = (delay = 120) => {
      if (spaSyncTimer) clearTimeout(spaSyncTimer);
      spaSyncTimer = setTimeout(() => {
        spaSyncTimer = null;
        initFixeaExtension();
      }, delay);
    };

    const onSpaUrlMaybeChanged = () => {
      if (location.href === lastSpaUrl) return;
      lastSpaUrl = location.href;
      scheduleSpaSync();
    };

    ["pushState", "replaceState"].forEach((method) => {
      const original = history[method];
      if (typeof original !== "function" || original.__fixeaPatched) return;

      const patched = function patchedHistory(...args) {
        const result = original.apply(this, args);
        onSpaUrlMaybeChanged();
        return result;
      };

      patched.__fixeaPatched = true;
      history[method] = patched;
    });

    window.addEventListener("popstate", onSpaUrlMaybeChanged);
    window.addEventListener("hashchange", onSpaUrlMaybeChanged);
    window.addEventListener("focus", () => scheduleSpaSync(0));

    try {
      if (window.navigation?.addEventListener) {
        window.navigation.addEventListener(
          "currententrychange",
          onSpaUrlMaybeChanged,
        );
        window.navigation.addEventListener("navigatesuccess", () => {
          onSpaUrlMaybeChanged();
          ensureToolbarMounted();
        });
      }
    } catch (error) {
    }

    function ensureToolbarMounted() {
      if (!environmentLinked || !linkedProjectId) return;
      if (!document.body) return;
      if (document.getElementById("fixea-toolbar-container")) return;

      mountProjectEnvironment({ projectId: linkedProjectId });
    }

    function ensureActivePinsRendered() {
      if (!environmentLinked || !linkedProjectId) return;
      if (isExpanded) return;
      if (!document.body) return;

      const expected = allPageTickets().filter((ticket) => ticket?.coords).length;

      if (expected === 0) return;
      if (document.querySelectorAll(".fixea-pin-badge").length >= expected) {
        return;
      }

      renderSavedAnnotations();
    }

    const watchdogTimer = setInterval(() => {
      if (!hasExtensionContext()) {
        clearInterval(watchdogTimer);
        return;
      }
      onSpaUrlMaybeChanged();
      ensureToolbarMounted();
      ensureActivePinsRendered();
    }, 1000);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") scheduleSpaSync(0);
    });
  }

  if (!isDashboardPage()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initFixeaExtension, {
        once: true,
      });
    } else {
      initFixeaExtension();
    }
  }
})();