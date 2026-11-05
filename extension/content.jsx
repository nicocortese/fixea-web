import React from "react";
import ReactDOM from "react-dom/client";
import ClientToolbar from "../app/components/ClientToolbar";

(() => {
  if (window.__fixeaLoaded) return;
  window.__fixeaLoaded = true;

  const STORAGE_KEY = "fixea_custom_tickets";
  // Inyectada por Vite en build-time desde VITE_FIXEA_API_BASE (.env).
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

  // Ignora un fixea_api_base cacheado de otra "familia" (dev <-> prod) para que
  // un build de producción no siga apuntando a localhost.
  function resolveStoredApiBase(value) {
    const raw =
      typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
    if (!raw) return DASHBOARD_ORIGIN;

    return isLoopbackBase(raw) === isLoopbackBase(DASHBOARD_ORIGIN)
      ? raw
      : DASHBOARD_ORIGIN;
  }

  function isDashboardPage() {
    if (location.origin === DASHBOARD_ORIGIN) return true;

    try {
      if (document.querySelector('meta[name="fixea-dashboard"]')) return true;
      const cachedOrigin = localStorage.getItem("fixea_dashboard_origin") || "";
      return !!cachedOrigin && cachedOrigin === location.origin;
    } catch (error) {
      return false;
    }
  }

  // Vercel (y otros hosts estáticos) devuelven un 404 duro cuando se entra
  // directo a una subruta de una SPA. El content script sí corre en esa página,
  // así que detectamos el 404 genérico y volvemos una sola vez al origen para
  // que el router del cliente arranque y resuelva la ruta sin recargar a mano.
  function isGenericRoute404() {
    if (location.pathname === "/" || location.pathname === "") return false;

    const title = (document.title || "").trim().toLowerCase();
    const body = (document.body?.innerText || "").slice(0, 500).toLowerCase();

    // Firmas de 404 duro de Vercel y del 404 por defecto de Next.js. Evitamos
    // matchear un 404 "de SPA" que la propia app renderiza en el cliente,
    // porque ahí el router ya funciona.
    return (
      title === "404: not_found" ||
      title === "404: this page could not be found." ||
      body.includes("404: not_found") ||
      body.includes("code: not_found") ||
      body.includes("this page could not be found")
    );
  }

  function recoverSpaRoute404() {
    if (!isGenericRoute404()) return false;

    const recoveryKey = `fixea_404_recovered:${location.origin}${location.pathname}`;

    try {
      if (sessionStorage.getItem(recoveryKey) === "1") return false;
      sessionStorage.setItem(recoveryKey, "1");
    } catch (error) {
      // Sin sessionStorage no arriesgamos un loop de redirecciones.
      return false;
    }

    console.info(
      "Fixea: ruta 404 detectada. Volviendo al origen para que la SPA arranque.",
    );
    location.replace(`${location.origin}/`);
    return true;
  }

  function parseProjectList(raw) {
    try {
      const value = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  // El match es por host/origen: el path del targetUrl se ignora. Un proyecto
  // registrado como sitio.com o sitio.com/login habilita toda la web.
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
        // URL inválida: se ignora y seguimos con la próxima.
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

  // El match contra la base es la fuente de verdad: si el proyecto está activo,
  // se inyecta el toolbar aunque todavía no haya una sesión cacheada. El
  // backend acepta tickets anónimos con projectId (author = "Cliente").
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
      .querySelectorAll(".fixea-pin-badge, .fixea-blur")
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
    stopRemoteRefresh();
  }

  function renderConnectCard(options = {}) {
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
    "#fixea-toolbar-container, #fixea-connect-card, #fixea-modal, #fixea-toast, #fixea-offline-banner, #fixea-status-popover, .fixea-pin-badge";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const STATUS_STYLES = {
    PENDIENTE: { color: "#00e5ff", opacity: 1 },
    EN_PROCESO: { color: "#ffea00", opacity: 0.75 },
    FINALIZADO: { color: "#00ff66", opacity: 0.45 },
  };
  const REMOTE_REFRESH_MS = 15000;
  let environmentLinked = false;
  let linkedProjectId = "";
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
  const COLOR_TOOLS = ["pin", "arrow", "highlight", "blur", "sticker"];
  const DRAG_TOOLS = ["arrow", "highlight", "blur"];
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
      (settings?.fixea_author || session.author || "").trim() || "Cliente";
    const createdBy = normalizeObjectId(
      settings?.fixea_created_by || session.userId,
    );
    const role = normalizeRole(settings?.fixea_role || session.role);
    // El proyecto se resuelve por match de URL, no por sesión: los tickets
    // anónimos también deben quedar asociados al proyecto correcto.
    const projectId =
      normalizeObjectId(matchedId) ||
      normalizeObjectId(settings?.fixea_project_id) ||
      normalizeObjectId(linkedProjectId);

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

  function persistEnvironment(env) {
    try {
      if (!hasExtensionContext() || !chrome.storage?.local) return;

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

      if (env.author) payload.fixea_author = env.author;
      else removeKeys.push("fixea_author");

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

      // Cualquier respuesta HTTP (aunque sea 401/500) prueba que está vivo.
      setServerReachable(true, { notify: false });
    } catch (error) {
      // Servidor apagado o red caída: degradamos sin romper la experiencia.
      authStatus = "offline";
      setServerReachable(false);
    }

    // Sin una respuesta confiable (offline o error no-401) NO pisamos la
    // sesión cacheada: devolvemos la última buena para seguir operando.
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
        "fixea_projects",
        "fixea_author",
        "fixea_created_by",
        "fixea_session",
        "fixea_api_base",
      ],
      (settings) => {
        const session = settings?.fixea_session || {};
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
          projects,
          author: settings?.fixea_author || session.author || "",
          userId: settings?.fixea_created_by || session.userId || "",
          email: session.email || "",
          role: session.role || "",
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
        { action: "delete_ticket", remoteId },
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
      el.style.visibility = hidden ? "hidden" : "";
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
        ],
        (settings) => {
          try {
            const send = (screenshotUrl) => {
              const payload = buildTicketPayload(
                screenshotUrl ? { ...ticket, screenshotUrl } : ticket,
                settings,
              );

              if (!payload.projectId) {
                persistSyncResult(
                  ticket.id,
                  { ok: false, error: "Sin proyecto vinculado" },
                  payload,
                );

                if (!silent) {
                  showToast(
                    "Conectá un proyecto en el Dashboard para enviar reportes.",
                  );
                }

                if (typeof onDone === "function") {
                  onDone(false, { error: "sin_proyecto" });
                }
                return;
              }

              sendTicketToBackground(payload, (response) => {
                persistSyncResult(ticket.id, response, payload);

                if (!response?.ok) {
                  const offline = isOfflineResponse(response);

                  if (offline) setServerReachable(false);

                  if (!silent) {
                    showToast(
                      offline
                        ? "Servidor de Fixea desconectado. El ticket quedó guardado localmente."
                        : "Ticket guardado localmente. Se reintentará al enviar.",
                      offline ? "error" : "default",
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
          }
        },
      );
    } catch (error) {
      warnContextInvalidated(error);
    }
  }

  function retryPendingTickets() {
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
    badge.style.setProperty(
      "--fixea-status-c",
      STATUS_STYLES[normalized].color,
    );
  }

  function refreshBadgeStatus(annotationId, status) {
    document
      .querySelectorAll(`.fixea-pin-badge[data-fixea-id="${annotationId}"]`)
      .forEach((badge) => applyBadgeStatus(badge, status));
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

        if (isOfflineResponse(response)) {
          setServerReachable(false);
          // Limpia pines remotos obsoletos; los tickets locales se conservan.
          if (remoteTickets.length > 0) {
            remoteTickets = [];
            renderSavedAnnotations();
          }
          finish(false);
          return;
        }

        if (!response?.ok || !Array.isArray(response?.data?.tickets)) {
          // offline === false significa que el servidor respondió (aunque sea
          // 401/500): está vivo, sólo falló esta operación.
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
      case "highlight": {
        const pts = g.dragging
          ? g.points
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
              w: Math.abs(x - x0),
              h: Math.abs(y - y0),
            }
          : { x: cl(x0 - 90), y: cl(y0 - 60), w: 180, h: 120 };
        return { ...base, coords: { x: s.x, y: s.y }, shape: s };
      }
      case "sticker": {
        const s = { x: cl(x0 - 75), y: cl(y0 - 50), w: 150, h: 100 };
        return { ...base, coords: { x: s.x, y: s.y }, shape: s };
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
    if (ann.type === "pin" || ann.type === "blur" || !ann.shape) return;
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
    } else if (ann.type === "sticker") {
      const fold = 18;
      svgEl(
        "path",
        {
          d: `M${s.x} ${s.y}H${s.x + s.w - fold}L${s.x + s.w} ${s.y + fold}V${s.y + s.h}H${s.x}Z`,
          fill: c,
          "fill-opacity": 0.92,
          stroke: "#08090e",
          "stroke-opacity": 0.35,
        },
        g,
      );
      svgEl(
        "path",
        {
          d: `M${s.x + s.w - fold} ${s.y}V${s.y + fold}H${s.x + s.w}Z`,
          fill: "#000",
          "fill-opacity": 0.18,
        },
        g,
      );
      const text = svgEl(
        "text",
        {
          x: s.x + 10,
          y: s.y + 32,
          fill: "#08090e",
          "font-size": 12,
          "font-weight": 600,
          "font-family": "system-ui, -apple-system, sans-serif",
        },
        g,
      );
      wrapText(ann.title, 17, 4).forEach((line, i) => {
        const ts = svgEl("tspan", { x: s.x + 10, dy: i ? 15 : 0 }, text);
        ts.textContent = line;
      });
    }
  }

  function createBadge(ann, number) {
    const b = document.createElement("div");
    b.className =
      "fixea-pin-badge fixea-pin-actionable" +
      (ann.type === "pin" ? "" : " fixea-pin-small");
    b.dataset.fixeaId = String(ann.id);
    b.style.left = `${ann.coords.x}px`;
    b.style.top = `${ann.coords.y}px`;
    b.style.setProperty("--fixea-c", ann.color);
    b.textContent = number;
    applyBadgeStatus(b, statusOf(ann));

    b.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (mode === "erase") {
        eraseTicket(ann.id);
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

  function renderAnnotation(ann, number) {
    createBlurBox(ann);
    drawShape(ann);
    createBadge(ann, number);
  }

  function removeAnnotation(id) {
    document
      .querySelectorAll(`[data-fixea-id="${id}"]`)
      .forEach((el) => el.remove());
  }

  function syncBadgeNumbers(list) {
    list.forEach((t) => {
      document
        .querySelectorAll(`.fixea-pin-badge[data-fixea-id="${t.id}"]`)
        .forEach((b) => (b.textContent = t.number));
    });
  }

  function renderSavedAnnotations() {
    document
      .querySelectorAll(".fixea-pin-badge, .fixea-blur, [data-fixea-ticket-pin]")
      .forEach((el) => el.remove());

    if (!isExpanded) return;
    if (pending || statusPopoverEl) return;

    const tickets = allPageTickets();
    if (!Array.isArray(tickets) || tickets.length === 0) return;

    tickets.forEach((t, i) => {
      if (t && t.coords) {
        renderAnnotation(normalizeAnnotation(t), t.number ?? i + 1);
      }
    });
  }

  function discardPending() {
    if (!pending) return;
    removeAnnotation(pending.ann.id);
    pending.modalEl.remove();
    pending = null;
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
    erase: [4, 20],
    pin: [2, 22],
    highlight: [2, 22],
    arrow: [2, 2],
    blur: [12, 12],
    sticker: [4, 4],
  };

  const CURSOR_FALLBACK = {
    erase: "cell",
    pin: "crosshair",
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
      case "pin":
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
    const tool = mode && CURSOR_OFFSETS[mode] ? mode : "";
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
    root.classList.toggle("fixea-drawing", COLOR_TOOLS.includes(mode));
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

  function setMode(next) {
    if (next !== mode) cancelGesture();
    mode = next;
    updateModeUI();
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
      mode = null;
      closeStatusPopover();
    }
    updateModeUI();
    renderSavedAnnotations();
  }

  function showToast(message, tone = "default") {
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

    if (reachable) {
      removeOfflineBanner();

      if (document.getElementById(CONNECT_CARD_ID)) {
        renderConnectCard({ offline: false });
      }

      if (!wasReachable) {
        // Al volver la conexión, reintenta lo que quedó guardado localmente.
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

    // Si el service worker no contesta, no dejamos el botón colgado.
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
    const ticket = getTickets().find((item) => String(item.id) === String(id));

    if (!ticket) {
      showToast("Ese ticket se gestiona desde la web");
      return;
    }

    const remoteId =
      ticket?.remoteId != null ? String(ticket.remoteId).trim() : "";

    const remaining = removeTicket(id);
    removeAnnotation(id);
    syncBadgeNumbers(remaining);
    remoteTickets = remoteTickets.filter(
      (item) => String(item._id ?? item.id) !== remoteId,
    );

    if (!remoteId) return;

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
            : "Borrado en pantalla, pero no en el servidor",
          offline ? "error" : "default",
        );
        return;
      }
      showToast("Ticket eliminado");
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

  function openDashboard() {
    if (isDashboardPage()) {
      setTimeout(() => {
        if (location.pathname === "/") location.reload();
        else location.assign(location.origin + "/");
      }, 900);
      return;
    }
    window.open(dashboardBaseUrl, "_blank", "noopener");
  }

  function handleSendTickets() {
    setMode(null);

    const all = getTickets();
    if (all.length === 0) {
      showToast("No hay tickets para enviar");
      return;
    }

    const pendingTickets = all.filter((ticket) => ticket.synced !== true);
    if (pendingTickets.length === 0) {
      showToast("Tickets enviados con éxito");
      openDashboard();
      return;
    }

    let remaining = pendingTickets.length;
    let sent = 0;
    let failed = 0;

    pendingTickets.forEach((ticket) => {
      syncTicket(ticket, {
        silent: true,
        onDone: (ok) => {
          if (ok) sent += 1;
          else failed += 1;
          remaining -= 1;

          if (remaining > 0) return;

          if (failed === 0) {
            showToast(
              sent === 1 ? "1 ticket enviado" : `${sent} tickets enviados`,
            );
            openDashboard();
            return;
          }

          const parts = [];
          if (sent > 0) {
            parts.push(sent === 1 ? "1 enviado" : `${sent} enviados`);
          }
          parts.push(
            failed === 1
              ? "1 falló, quedó guardado localmente"
              : `${failed} fallaron, quedaron guardados localmente`,
          );
          showToast(parts.join(" · "));
        },
      });
    });
  }

  // ---- RENDER TOOLBAR CON REACT + SHADOW DOM ----
  function buildToolbar() {
    if (isDashboardPage()) return;
    if (document.getElementById("fixea-toolbar-container")) return;
    if (!document.body) return;

    const toolbarContainer = document.createElement("div");
    toolbarContainer.id = "fixea-toolbar-container";
    document.body.appendChild(toolbarContainer);

    toolbarContainer.addEventListener("click", (e) => e.stopPropagation());

    const shadowRoot = toolbarContainer.attachShadow({ mode: "open" });
    const shadowContainer = document.createElement("div");
    shadowRoot.appendChild(shadowContainer);

    const styleElement = document.createElement("style");
    styleElement.textContent = `
      @import url('https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css');
      *, ::before, ::after { box-sizing: border-box; }
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

      const handleToolSelect = (tool) => {
        if (tool === "undo") {
          undoLast();
          return;
        }
        if (tool === "send") {
          handleSendTickets();
          return;
        }
        setCurrentTool(tool);
        toggleTool(tool);
      };

      const handleColorSelect = (color) => {
        setCurrentColor(color);
        setActiveColor(color);
      };

      const handleExpandedChange = (expanded) => {
        setExpanded(expanded);
      };

      return (
        <ClientToolbar
          activeTool={currentTool}
          setActiveTool={handleToolSelect}
          activeColor={currentColor}
          onColorChange={handleColorSelect}
          onExpandedChange={handleExpandedChange}
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

  // Guarda el proyecto que devolvió el backend para que sobreviva a un F5 y
  // para que buildTicketPayload lo encuentre sin depender del cache del
  // Dashboard. Sólo escribe si algo cambió: evita loops con storage.onChanged.
  function persistMatchedProject(project) {
    const id = normalizeObjectId(project?.id || project?._id);
    if (!id || !hasExtensionContext() || !chrome.storage?.local) return;

    const entry = {
      id,
      name: typeof project.name === "string" ? project.name : "",
      targetUrl: typeof project.targetUrl === "string" ? project.targetUrl : "",
    };

    readLocalSettings(
      [
        "fixea_projects",
        "fixea_project_id",
        "fixea_project",
        "fixea_project_target_url",
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
          existing.targetUrl === entry.targetUrl;
        const sameSelection =
          String(settings?.fixea_project_id || "") === id &&
          String(settings?.fixea_project || "") === entry.name &&
          String(settings?.fixea_project_target_url || "") === entry.targetUrl;

        if (sameProject && sameSelection) return;

        suppressStorageReinitUntil = Date.now() + 1500;

        try {
          chrome.storage.local.set({
            fixea_projects: nextProjects,
            fixea_project_id: id,
            fixea_project: entry.name,
            fixea_project_target_url: entry.targetUrl,
          });
        } catch (error) {
          warnContextInvalidated(error);
        }
      },
    );
  }

  function linkMatchedProject(project, callback) {
    const id = normalizeObjectId(project?.id || project?._id);

    if (!id) {
      callback(null);
      return;
    }

    persistMatchedProject(project);

    readCachedEnvironment((env) => {
      const projects = Array.isArray(env.projects) ? env.projects.slice() : [];
      const entry = {
        id,
        name: typeof project.name === "string" ? project.name : "",
        targetUrl:
          typeof project.targetUrl === "string" ? project.targetUrl : "",
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
        projects,
      });
    });
  }

  function mountProjectEnvironment(env) {
    if (!env?.projectId) return false;

    linkedProjectId = String(env.projectId || "");
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
    const toolbar = document.getElementById("fixea-toolbar-container");
    if (toolbar) toolbar.remove();

    stopRemoteRefresh();
    remoteTickets = [];
    clearRenderedAnnotations();
    removeConnectCard();
    removeOfflineBanner();
  }

  function initFixeaExtension() {
    if (isDashboardPage()) return;
    if (!document.body) return;

    const pageOrigin = location.origin;
    const requestId = ++matchRequestId;

    readCachedEnvironment((env) => {
      sendToBackground(
        { action: "match_project", origin: pageOrigin },
        (response) => {
          if (requestId !== matchRequestId) return;

          // Sin red: degradamos al último proyecto cacheado (si lo hay). La
          // UI recién aparece cuando la verificación terminó, no antes.
          if (response?.offline === true) {
            if (canAnnotate(env)) {
              if (recoverSpaRoute404()) return;
              setServerReachable(false, { notify: false });
              mountProjectEnvironment(env);
            }
            return;
          }

          // Respuesta incierta (500, timeout no clasificado, etc.): no tocamos
          // la UI. Una página sin match debe quedar 100% invisible.
          if (!response || response.ok !== true || typeof response.match !== "boolean") {
            return;
          }

          if (!response.match) {
            unmountProjectEnvironment();
            return;
          }

          // Si la ruta actual es un 404 duro de un host estático, volvemos al
          // origen para que la SPA arranque. No montamos toolbar encima del 404.
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

        // Si el toolbar ya está montado, el clic no lo duplica.
        if (
          environmentLinked &&
          document.getElementById("fixea-toolbar-container")
        ) {
          sendResponse({ ok: true, mode: "toolbar" });
          return false;
        }

        readCachedEnvironment((env) => {
          // El clic explícito vuelve a preguntar al backend: el cache puede
          // estar vacío o desactualizado. Sin match, mostramos el cartel.
          sendToBackground(
            { action: "match_project", origin: location.origin },
            (response) => {
              if (response?.ok === true && response.match === true) {
                linkMatchedProject(response.project, (nextEnv) => {
                  mountProjectEnvironment(nextEnv);
                  sendResponse({ ok: true, mode: "toolbar" });
                });
                return;
              }

              // Sin red, si hay un proyecto cacheado para este sitio seguimos
              // operando offline; si no, el cartel explica el estado.
              if (response?.offline === true && canAnnotate(env)) {
                setServerReachable(false, { notify: false });
                mountProjectEnvironment(env);
                sendResponse({ ok: true, mode: "toolbar", offline: true });
                return;
              }

              const offline = response?.offline === true;
              if (offline) setServerReachable(false, { notify: false });
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
        // El background avisa al activar/cambiar de pestaña o cuando cambia el
        // estado del proyecto. No hace falta recargar: se revalida el origen y
        // se monta/actualiza el toolbar en el mismo documento.
        if (isDashboardPage()) {
          try {
            window.dispatchEvent(new CustomEvent("fixea:environment-synced"));
          } catch (error) {}
        } else {
          initFixeaExtension();
        }

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
            localStorage.setItem("fixea_tickets_rev", String(Date.now()));
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
      if (!COLOR_TOOLS.includes(mode) || e.button !== 0 || isUI(e.target))
        return;

      e.preventDefault();
      e.stopPropagation();
      discardPending();

      const x = Math.round(e.pageX);
      const y = Math.round(e.pageY);
      gesture = {
        id: Date.now(),
        type: mode,
        color: activeColor,
        x0: x,
        y0: y,
        x,
        y,
        points: [[x, y]],
        dragging: false,
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

      if (
        !gesture.dragging &&
        Math.hypot(gesture.x - gesture.x0, gesture.y - gesture.y0) >= MIN_DRAG
      ) {
        gesture.dragging = true;
      }
      if (gesture.type === "highlight") {
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

  document.addEventListener(
    "pointerup",
    (e) => {
      if (!gesture) return;
      e.preventDefault();
      e.stopPropagation();

      const g = gesture;
      gesture = null;
      suppressClickUntil = performance.now() + 400;

      removeAnnotation(g.id);
      const ann = buildAnnotation(g);
      const number = nextTicketNumber();

      renderAnnotation(ann, number);
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
        COLOR_TOOLS.includes(mode)
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

  function closeStatusPopover() {
    if (!statusPopoverEl) return;
    statusPopoverEl.remove();
    statusPopoverEl = null;
  }

  function positionStatusPopover(el, ann) {
    const WIDTH = 226;

    if (!ann?.coords) return;

    const minLeft = window.scrollX + 12;
    const maxLeft = window.scrollX + window.innerWidth - WIDTH - 12;
    const preferredLeft = ann.coords.x + 28;

    el.style.left = `${Math.max(Math.min(preferredLeft, maxLeft), minLeft)}px`;
    el.style.top = `${Math.max(ann.coords.y - 24, window.scrollY + 12)}px`;
  }

  function statusPopoverMarkup(ann, status) {
    const color = STATUS_STYLES[status].color;
    const canVerify = status === "EN_PROCESO" && !!remoteIdOf(ann);

    let footer = "";

    if (canVerify) {
      footer = `
        <div class="fixea-status-actions">
          <button type="button" data-action="reject" class="fixea-status-btn fixea-status-reject">
            Sigue roto
          </button>
          <button type="button" data-action="approve" class="fixea-status-btn fixea-status-approve">
            Verificar / Aprobar corrección
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

      <p class="fixea-status-title">${escapeHtml(ann.title || "Sin descripción")}</p>

      <div class="fixea-status-devnote">
        <span>Respuesta técnica</span>
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
    positionStatusPopover(popover, ann);

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
      { action: "update_ticket_status", remoteId, status: nextStatus },
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

        showToast(
          nextStatus === "FINALIZADO"
            ? "Fix aprobado correctamente"
            : "Ticket devuelto a pendientes",
        );
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
            <img class="fixea-modal-logo" src="${LOGO_URL}" alt="Fixea" />
            <span>${ann.type === "sticker" ? "REPORTAR SUGERENCIA" : "REPORTAR PROBLEMA"}</span>
          </div>
          <button type="button" id="fixea-close-btn" class="fixea-close-btn" title="Cerrar reporte" aria-label="Cerrar reporte">
            ${CLOSE_SVG}
          </button>
        </div>

        <div class="fixea-author-row">
          <div class="fixea-avatar" id="fixea-author-avatar">C</div>
          <div class="fixea-author-field">
            <input id="fixea-author-input" class="fixea-author-input" type="text" maxlength="40" value="" placeholder="Tu nombre" aria-label="Nombre del cliente" />
            <p class="fixea-author-hint">Tu opinión es clave</p>
          </div>
        </div>

        <textarea id="fixea-ticket-text" rows="3" maxlength="500" placeholder="Cambiá el texto..." aria-label="Descripción del reporte"></textarea>

        <div class="fixea-modal-footer">
          <label class="fixea-priority">
            <span class="fixea-priority-dot" id="fixea-priority-dot"></span>
            <span>Prioridad</span>
            <span class="fixea-priority-value" id="fixea-priority-value">Alta</span>
            <select id="fixea-priority-select" aria-label="Prioridad del ticket">
              ${PRIORITIES.map(
                (option) =>
                  `<option value="${option.value}">${option.value}</option>`,
              ).join("")}
            </select>
            ${CHEVRON_SVG}
          </label>

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
    const prioritySelect = modal.querySelector("#fixea-priority-select");
    const priorityDot = modal.querySelector("#fixea-priority-dot");
    const priorityValue = modal.querySelector("#fixea-priority-value");
    const sendBtn = modal.querySelector("#fixea-send-btn");

    readLocalSettings(["fixea_author"], (settings) => {
      const stored = (settings?.fixea_author || "").trim();
      if (!stored || authorInput.value) return;
      authorInput.value = stored;
      authorAvatar.textContent = stored.charAt(0).toUpperCase();
    });

    const syncPriority = () => {
      const selected =
        PRIORITIES.find((option) => option.value === prioritySelect.value) ||
        PRIORITIES[0];
      priorityDot.style.backgroundColor = selected.color;
      priorityDot.style.boxShadow = `0 0 8px ${selected.color}`;
      priorityValue.style.color = selected.color;
      priorityValue.textContent = selected.value;
    };

    const syncAvatar = () => {
      const initial = (authorInput.value.trim() || "C").charAt(0).toUpperCase();
      authorAvatar.textContent = initial;
    };

    prioritySelect.addEventListener("change", syncPriority);
    authorInput.addEventListener("input", syncAvatar);
    syncPriority();
    syncAvatar();

    setTimeout(() => titleInput && titleInput.focus(), 100);

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
      const priority = prioritySelect.value;
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
        }
      } catch (error) {
        warnContextInvalidated(error);
      }

      saveTicket(ticket);
      syncTicket(ticket);

      ann.title = titleText;
      if (ann.type === "sticker") drawShape(ann);
      syncBadgeNumbers([{ id: ann.id, number: ticketNumber }]);
      pending = null;

      sendBtn.querySelector("span").textContent = "¡ENVIADO!";
      sendBtn.disabled = true;

      setTimeout(() => modal.remove(), 800);
    });
  }

  // ---- Arranque ----
  if (isDashboardPage()) {
    let envSyncTimer = null;

    const syncEnvironmentSoon = (delay = 150) => {
      if (envSyncTimer) clearTimeout(envSyncTimer);
      envSyncTimer = setTimeout(() => {
        envSyncTimer = null;
        resolveDashboardEnvironment().catch(() => {});
      }, delay);
    };

    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key.startsWith("fixea_")) {
        syncEnvironmentSoon();
      }
    });

    window.addEventListener("fixea:environment-synced", () => {
      resolveDashboardEnvironment()
        .catch(() => {})
        .finally(() => {
          try {
            window.dispatchEvent(new CustomEvent("fixea:environment-sync-done"));
          } catch (error) {}
        });
    });

    let lastUrl = location.href;

    const onUrlMaybeChanged = () => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      syncEnvironmentSoon();
    };

    ["pushState", "replaceState"].forEach((method) => {
      const original = history[method];
      if (typeof original !== "function") return;

      history[method] = function patchedHistory(...args) {
        const result = original.apply(this, args);
        onUrlMaybeChanged();
        return result;
      };
    });

    window.addEventListener("popstate", onUrlMaybeChanged);
    window.addEventListener("hashchange", onUrlMaybeChanged);
    setInterval(onUrlMaybeChanged, 2000);

    window.addEventListener("focus", () => syncEnvironmentSoon(0));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") syncEnvironmentSoon(0);
    });
    setInterval(() => {
      if (document.visibilityState === "visible") syncEnvironmentSoon(0);
    }, 15000);

    syncEnvironmentSoon(0);
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
            // Pequeña espera para que el background invalide el cache de
            // matches antes de volver a consultar el origen.
            setTimeout(initFixeaExtension, 75);
          }
        });
      }
    } catch (error) {
      warnContextInvalidated(error);
    }

    // Las SPA cambian de ruta con history.pushState/replaceState, sin recargar
    // el documento. Revalidamos el origen (no el path) y volvemos a montar el
    // toolbar para que sobreviva a la navegación del cliente.
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
    setInterval(onSpaUrlMaybeChanged, 1000);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") scheduleSpaSync(0);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFixeaExtension, {
      once: true,
    });
  } else {
    initFixeaExtension();
  }
})();