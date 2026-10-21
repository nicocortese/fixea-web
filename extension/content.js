(() => {
  if (window.__fixeaLoaded) return;
  window.__fixeaLoaded = true;

  const STORAGE_KEY = "fixea_custom_tickets";
  const DASHBOARD_ORIGIN = "http://localhost:3000";
  const DASHBOARD_URL = `${DASHBOARD_ORIGIN}/`;
  const UI_SELECTOR = "#fixea-toolbar-container, #fixea-modal, #fixea-toast";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const COLORS = [
    { value: "#00e5ff", name: "Cian" },
    { value: "#ff007f", name: "Magenta" },
    { value: "#7000FF", name: "Violeta" },
  ];
  const COLOR_TOOLS = ["pin", "arrow", "highlight", "grid", "sticker"];
  const DRAG_TOOLS = ["arrow", "highlight", "grid"];
  const TOOL_LABEL = {
    pin: "Pluma",
    arrow: "Flecha",
    highlight: "Resaltador",
    grid: "Cuadrícula",
    sticker: "Nota",
  };
  const MIN_DRAG = 8;
  const GRID_STEP = 24;

  // ---- Estado ----
  let mode = null; // null | "erase" | "pin" | "arrow" | "highlight" | "grid" | "sticker"
  let activeColor = COLORS[0].value;
  let isExpanded = false;
  let pending = null; // { ann, modalEl } mientras el modal de ticket está abierto
  let gesture = null; // trazo en curso
  let suppressClickUntil = 0;
  let toastTimer = null;

  const pageKey = () => location.origin + location.pathname + location.search;
  const isUI = (t) => t instanceof Element && !!t.closest(UI_SELECTOR);
  const cl = (v) => Math.max(0, Math.round(v));

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
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      callback({});
      return;
    }

    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime?.lastError) {
          callback({});
          return;
        }
        callback(result || {});
      });
    } catch (error) {
      console.warn("Fixea: no se pudo leer chrome.storage", error);
      callback({});
    }
  }

  function buildTicketPayload(ticket, settings) {
    const project = (settings?.fixea_project || "").trim() || location.hostname;
    const author = (settings?.fixea_author || "").trim() || "Cliente";

    return {
      id: ticket.id || Date.now(),
      number: ticket.number,
      type: ticket.type,
      color: ticket.color,
      shape: ticket.shape || null,
      project,
      title: ticket.title,
      priority: ticket.priority || "Alta",
      status: "PENDIENTE",
      author,
      coords: ticket.coords,
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
        author: payload.author,
        synced: !!response?.ok,
        remoteId: remoteId ? String(remoteId) : ticket.remoteId ?? null,
        syncError: response?.ok ? null : response?.error || "Error de red",
      };
    });

    if (found) setTickets(next);
  }

  function sendTicketToBackground(payload, callback) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      callback({ ok: false, status: 0, error: "chrome.runtime no disponible" });
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { action: "create_ticket", payload },
        (response) => {
          if (chrome.runtime?.lastError) {
            callback({
              ok: false,
              status: 0,
              error: chrome.runtime.lastError.message,
            });
            return;
          }
          callback(response || { ok: false, status: 0, error: "Sin respuesta" });
        }
      );
    } catch (error) {
      callback({
        ok: false,
        status: 0,
        error: error?.message || "Error al enviar el ticket",
      });
    }
  }

  function setFixeaUiHidden(hidden) {
    document.querySelectorAll(UI_SELECTOR).forEach((el) => {
      el.style.visibility = hidden ? "hidden" : "";
    });
  }

  // Pide al background una captura de la pestaña visible. Devuelve null si el
  // navegador no la permite (por ejemplo, sin permisos de host). Oculta la UI
  // de Fixea para que el screenshot muestre solo la página con anotaciones.
  function captureScreenshot(callback) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
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

    // Si el background no responde, restauramos la UI y seguimos sin captura.
    timer = setTimeout(() => finish(null), 5000);

    // Dos frames para que el navegador pinte la UI oculta antes de capturar.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          chrome.runtime.sendMessage(
            { action: "capture_screenshot" },
            (response) => {
              if (chrome.runtime?.lastError) {
                finish(null);
                return;
              }
              finish(response?.screenshotUrl || null);
            }
          );
        } catch (error) {
          console.warn("Fixea: no se pudo capturar la pantalla", error);
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

  // Envía un ticket al background worker y actualiza el cache local.
  // `silent` evita el toast en los reintentos automáticos.
  function syncTicket(ticket, options = {}) {
    if (!ticket) return;

    const { silent = false, onDone } = options;

    readLocalSettings(["fixea_project", "fixea_author"], (settings) => {
      const send = (screenshotUrl) => {
        const payload = buildTicketPayload(
          screenshotUrl ? { ...ticket, screenshotUrl } : ticket,
          settings
        );

        sendTicketToBackground(payload, (response) => {
          persistSyncResult(ticket.id, response, payload);

          if (!response?.ok && !silent) {
            showToast("Ticket guardado localmente. Se reintentará al enviar.");
          } else if (!response?.ok) {
            console.warn(
              "Fixea: no se pudo sincronizar el ticket",
              ticket.id,
              response?.error
            );
          }

          if (typeof onDone === "function") onDone(!!response?.ok, response);
        });
      };

      // Los reintentos reutilizan la captura original guardada en localStorage.
      if (ticket.screenshotUrl || ticket.screenshot) {
        send(null);
        return;
      }

      captureScreenshot((screenshotUrl) => {
        if (screenshotUrl) attachScreenshot(ticket.id, screenshotUrl);
        send(screenshotUrl);
      });
    });
  }

  function retryPendingTickets() {
    getTickets()
      .filter((ticket) => ticket.synced !== true)
      .forEach((ticket) => syncTicket(ticket, { silent: true }));
  }

  // Quita un ticket y renumera el resto (#1..#N) para no dejar huecos
  function removeTicket(id) {
    const remaining = getTickets()
      .filter((t) => String(t.id) !== String(id))
      .map((t, i) => ({ ...t, number: i + 1 }));
    setTickets(remaining);
    return remaining;
  }

  const nextTicketNumber = () => getTickets().length + 1;
  const pageTickets = () => getTickets().filter((t) => t.coords && t.url === pageKey());

  // ---- Geometría (hit-test de la goma) ----
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
    if (a.coords && Math.hypot(px - a.coords.x, py - a.coords.y) <= badgeR) return true;

    switch (a.type) {
      case "arrow":
        return distToSegment(px, py, s.x1, s.y1, s.x2, s.y2) <= 12;
      case "highlight": {
        const p = s.points || [];
        for (let i = 0; i < p.length - 1; i++) {
          if (distToSegment(px, py, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) <= 14) return true;
        }
        return false;
      }
      case "grid":
      case "sticker":
        return px >= s.x - 6 && px <= s.x + s.w + 6 && py >= s.y - 6 && py <= s.y + s.h + 6;
      default:
        return false;
    }
  }

  // ---- Anotaciones: modelo ----
  // { id, type, color, coords:{x,y}, shape, title? }
  function buildAnnotation(g) {
    const { id, type, color, x0, y0, x, y } = g;
    const base = { id, type, color };

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
        return { ...base, coords: { x: pts[0][0], y: pts[0][1] }, shape: { points: pts } };
      }
      case "grid": {
        const s = g.dragging
          ? { x: Math.min(x0, x), y: Math.min(y0, y), w: Math.abs(x - x0), h: Math.abs(y - y0) }
          : { x: cl(x0 - 72), y: cl(y0 - 72), w: 144, h: 144 };
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

  // ---- Anotaciones: render (SVG overlay + badge numérico) ----
  function svgEl(name, attrs, parent) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (parent) parent.appendChild(el);
    return el;
  }

  // SVG de 1x1 en el origen del documento con overflow visible: dibuja en coordenadas de página
  function ensureOverlay() {
    let o = document.getElementById("fixea-overlay");
    if (o) return o;
    o = svgEl("svg", { id: "fixea-overlay", width: 1, height: 1 });
    document.body.appendChild(o);
    return o;
  }

  function wrapText(str, max, maxLines) {
    const words = String(str || "").split(/\s+/).filter(Boolean);
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
    if (ann.type === "pin" || !ann.shape) return;
    const overlay = ensureOverlay();
    const old = overlay.querySelector(`[data-fixea-id="${ann.id}"]`);
    if (old) old.remove();

    const g = svgEl("g", { class: "fixea-shape", "data-fixea-id": ann.id }, overlay);
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
        g
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
        g
      );
    } else if (ann.type === "grid") {
      svgEl(
        "rect",
        { x: s.x, y: s.y, width: s.w, height: s.h, rx: 2, fill: c, "fill-opacity": 0.08, stroke: c, "stroke-width": 2 },
        g
      );
      let d = "";
      for (let gx = s.x + GRID_STEP; gx < s.x + s.w; gx += GRID_STEP) d += `M${gx} ${s.y}V${s.y + s.h}`;
      for (let gy = s.y + GRID_STEP; gy < s.y + s.h; gy += GRID_STEP) d += `M${s.x} ${gy}H${s.x + s.w}`;
      if (d) svgEl("path", { d, fill: "none", stroke: c, "stroke-opacity": 0.6, "stroke-width": 1 }, g);
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
        g
      );
      svgEl(
        "path",
        { d: `M${s.x + s.w - fold} ${s.y}V${s.y + fold}H${s.x + s.w}Z`, fill: "#000", "fill-opacity": 0.18 },
        g
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
        g
      );
      wrapText(ann.title, 17, 4).forEach((line, i) => {
        const ts = svgEl("tspan", { x: s.x + 10, dy: i ? 15 : 0 }, text);
        ts.textContent = line;
      });
    }
  }

  function createBadge(ann, number) {
    const b = document.createElement("div");
    b.className = "fixea-pin-badge" + (ann.type === "pin" ? "" : " fixea-pin-small");
    b.dataset.fixeaId = String(ann.id);
    b.style.left = `${ann.coords.x}px`;
    b.style.top = `${ann.coords.y}px`;
    b.style.setProperty("--fixea-c", ann.color);
    b.textContent = number;
    document.body.appendChild(b);
    return b;
  }

  function renderAnnotation(ann, number) {
    drawShape(ann);
    createBadge(ann, number);
  }

  function removeAnnotation(id) {
    document.querySelectorAll(`[data-fixea-id="${id}"]`).forEach((el) => el.remove());
  }

  function syncBadgeNumbers(list) {
    list.forEach((t) => {
      document
        .querySelectorAll(`.fixea-pin-badge[data-fixea-id="${t.id}"]`)
        .forEach((b) => (b.textContent = t.number));
    });
  }

  // Redibuja las anotaciones guardadas de esta página (para poder borrarlas tras recargar)
  function renderSavedAnnotations() {
    pageTickets().forEach((t, i) => {
      const ann = { ...t, type: t.type || "pin", color: t.color || COLORS[0].value };
      if (ann.type !== "pin" && !ann.shape) ann.type = "pin";
      renderAnnotation(ann, t.number ?? i + 1);
    });
  }

  // ---- Pendiente (anotación con modal abierto, todavía sin guardar) ----
  function discardPending() {
    if (!pending) return;
    removeAnnotation(pending.ann.id);
    pending.modalEl.remove();
    pending = null;
  }

  // ---- Modos / herramientas ----
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

    // Solo visible con una herramienta que usa color; goma / deshacer / enviar lo ocultan
    const show = isExpanded && COLOR_TOOLS.includes(mode);
    pill.classList.toggle("fixea-pill-hidden", !show);

    if (show) {
      const btn = document.querySelector(`#fixea-expanded-bar [data-tool="${mode}"]`);
      if (btn) pill.style.top = `${btn.offsetTop + btn.offsetHeight / 2}px`;
    }
    pill.querySelectorAll(".fixea-color-dot").forEach((d) => {
      d.classList.toggle("fixea-color-selected", d.dataset.color === activeColor);
    });
  }

  function updateModeUI() {
    const root = document.documentElement;
    root.classList.toggle("fixea-drawing", COLOR_TOOLS.includes(mode));
    root.classList.toggle("fixea-erasing", mode === "erase");

    document.querySelectorAll("#fixea-expanded-bar [data-tool]").forEach((b) => {
      b.classList.toggle("fixea-active-icon", b.dataset.tool === mode);
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
    updateColorPill();
  }

  function setExpanded(value) {
    isExpanded = value;
    const bar = document.getElementById("fixea-expanded-bar");
    const label = document.getElementById("fixea-label-icon");
    const fab = document.getElementById("fixea-flotante-btn");
    if (!bar || !label) return;

    bar.classList.toggle("fixea-bar-hidden", !isExpanded);
    label.textContent = isExpanded ? "−" : "+";
    if (fab) fab.setAttribute("aria-expanded", String(isExpanded));

    if (!isExpanded) {
      cancelGesture();
      mode = null; // al colapsar se apaga cualquier herramienta
    }
    updateModeUI();
  }

  // ---- Toast ----
  function showToast(message) {
    const old = document.getElementById("fixea-toast");
    if (old) old.remove();
    clearTimeout(toastTimer);

    const toast = document.createElement("div");
    toast.id = "fixea-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    toastTimer = setTimeout(() => toast.remove(), 3000);
  }

  // ---- Goma / Deshacer ----
  function findHit(e) {
    const px = e.pageX;
    const py = e.pageY;
    if (pending && hitAnnotation(pending.ann, px, py)) return { pending: true };

    const list = pageTickets();
    for (let i = list.length - 1; i >= 0; i--) {
      const t = list[i];
      const ann = { ...t, type: t.type || "pin" };
      if (hitAnnotation(ann, px, py)) return { ticket: t };
    }
    return null;
  }

  function eraseTicket(id) {
    // TODO: delete remote ticket via the API when ticket.remoteId is present.
    const remaining = removeTicket(id);
    removeAnnotation(id);
    syncBadgeNumbers(remaining);
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

  // ---- Enviar (avioncito) ----
  function openDashboard() {
    if (location.origin === DASHBOARD_ORIGIN) {
      // Dentro de la web app: ir al dashboard, o refrescar si ya estamos ahí
      setTimeout(() => {
        if (location.pathname === "/") location.reload();
        else location.href = DASHBOARD_URL;
      }, 900);
      return;
    }
    // Desde otra web: nueva pestaña (se llama dentro del click => no lo bloquea el navegador)
    window.open(DASHBOARD_URL, "_blank", "noopener");
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
            showToast(sent === 1 ? "1 ticket enviado" : `${sent} tickets enviados`);
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
              : `${failed} fallaron, quedaron guardados localmente`
          );
          showToast(parts.join(" · "));
        },
      });
    });
  }

  // ---- Toolbar ----
  function initFixeaExtension() {
    if (document.getElementById("fixea-toolbar-container")) return;
    if (!document.body) return;

    const toolbarContainer = document.createElement("div");
    toolbarContainer.id = "fixea-toolbar-container";

    toolbarContainer.innerHTML = `
      <div id="fixea-expanded-bar" class="fixea-bar-hidden">
        <button type="button" id="fixea-eraser-btn" class="fixea-bar-icon" data-tool="erase" title="Goma">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3a1 1 0 0 1 0-1.4l13-13a1 1 0 0 1 1.4 0l4.3 4.3a1 1 0 0 1 0 1.4l-13 13a1 1 0 0 1-1.4 0z"></path><path d="M22 21H7"></path><path d="m5 11 9 9"></path></svg>
        </button>
        <button type="button" id="fixea-undo-btn" class="fixea-bar-icon" title="Deshacer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
        </button>
        <button type="button" id="fixea-grid-btn" class="fixea-bar-icon" data-tool="grid" title="Cuadrícula">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path><path d="M3 15h18"></path><path d="M9 3v18"></path><path d="M15 3v18"></path></svg>
        </button>
        <button type="button" id="fixea-arrow-btn" class="fixea-bar-icon" data-tool="arrow" title="Flecha">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
        </button>
        <button type="button" id="fixea-highlight-btn" class="fixea-bar-icon" data-tool="highlight" title="Resaltador">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h3l6-6"></path><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path></svg>
        </button>
        <button type="button" id="fixea-pin-btn" class="fixea-bar-icon" data-tool="pin" title="Pluma / Crear Ticket">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
        </button>
        <button type="button" id="fixea-sticker-btn" class="fixea-bar-icon" data-tool="sticker" title="Nota / Sticker">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"></path><path d="M15 3v5h5"></path></svg>
        </button>
        <button type="button" id="fixea-send-trigger-btn" class="fixea-bar-icon" title="Enviar feedback">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
        <div id="fixea-color-pill" class="fixea-pill-hidden"></div>
      </div>

      <button type="button" id="fixea-flotante-btn" class="fixea-fab-btn" title="Abrir/Cerrar Fixea" aria-expanded="false">
        <span id="fixea-label-icon">+</span>
      </button>
    `;

    document.body.appendChild(toolbarContainer);

    // Los clics de la toolbar no burbujean a handlers de la página
    toolbarContainer.addEventListener("click", (e) => e.stopPropagation());

    // Selector de color (se arma con DOM para no depender de estilos inline)
    const pill = document.getElementById("fixea-color-pill");
    COLORS.forEach((c) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "fixea-color-dot";
      dot.dataset.color = c.value;
      dot.title = c.name;
      dot.style.setProperty("--dot", c.value);
      dot.addEventListener("click", (e) => {
        e.preventDefault();
        setActiveColor(c.value);
      });
      pill.appendChild(dot);
    });

    document.getElementById("fixea-flotante-btn").addEventListener("click", (e) => {
      e.preventDefault();
      setExpanded(!isExpanded);
    });

    toolbarContainer.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleTool(btn.dataset.tool);
      });
    });

    document.getElementById("fixea-undo-btn").addEventListener("click", (e) => {
      e.preventDefault();
      undoLast();
    });

    document.getElementById("fixea-send-trigger-btn").addEventListener("click", (e) => {
      e.preventDefault();
      handleSendTickets();
    });

    setExpanded(false);
    updateColorPill();
    renderSavedAnnotations();
    retryPendingTickets();
  }

  // ---- Mensajes desde popup / background ----
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggle_pinning") {
      initFixeaExtension();
      setMode("pin");
      sendResponse({ active: mode === "pin" });
    }
  });

  // ---- Gestos de dibujo (fase de captura: la página no ve estos eventos) ----
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!COLOR_TOOLS.includes(mode) || e.button !== 0 || isUI(e.target)) return;

      e.preventDefault();
      e.stopPropagation();
      discardPending(); // una anotación sin enviar se descarta al empezar otra

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
      };
    },
    true
  );

  document.addEventListener(
    "pointermove",
    (e) => {
      if (!gesture) return;

      gesture.x = Math.round(e.pageX);
      gesture.y = Math.round(e.pageY);

      if (!gesture.dragging && Math.hypot(gesture.x - gesture.x0, gesture.y - gesture.y0) >= MIN_DRAG) {
        gesture.dragging = true;
      }
      if (gesture.type === "highlight") {
        const last = gesture.points[gesture.points.length - 1];
        if (Math.hypot(gesture.x - last[0], gesture.y - last[1]) >= 3) {
          gesture.points.push([gesture.x, gesture.y]);
        }
      }
      if (DRAG_TOOLS.includes(gesture.type) && gesture.dragging) {
        drawShape(buildAnnotation(gesture)); // vista previa en vivo
      }
    },
    true
  );

  document.addEventListener(
    "pointerup",
    (e) => {
      if (!gesture) return;
      e.preventDefault();
      e.stopPropagation();

      const g = gesture;
      gesture = null;
      suppressClickUntil = performance.now() + 400; // evita que el click final active links de la página

      removeAnnotation(g.id); // quita la vista previa; se renderiza la versión final
      const ann = buildAnnotation(g);
      const number = nextTicketNumber();

      renderAnnotation(ann, number);
      createModalElement(ann, number, { x: g.x, y: g.y });
      setMode(null);
    },
    true
  );

  document.addEventListener("pointercancel", cancelGesture, true);

  // ---- Click global (fase de captura): goma + supresión del click tras dibujar ----
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

      if (performance.now() < suppressClickUntil || COLOR_TOOLS.includes(mode)) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );

  // Esc cancela el trazo / herramienta activa
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (mode || gesture)) {
      cancelGesture();
      setMode(null);
    }
  });

  // ---- Modal de ticket ----
  function createModalElement(ann, number, at) {
    discardPending(); // por seguridad: nunca más de un modal abierto

    const modal = document.createElement("div");
    modal.id = "fixea-modal";
    modal.className = "fixea-floating-modal";

    const modalLeft = Math.max(
      Math.min(at.x + 20, window.scrollX + window.innerWidth - 360),
      window.scrollX + 10
    );
    const modalTop = Math.max(at.y - 20, window.scrollY + 20);
    modal.style.left = `${modalLeft}px`;
    modal.style.top = `${modalTop}px`;

    modal.innerHTML = `
      <div class="fixea-modal-header">
        <div class="fixea-modal-title">
          <span class="fixea-bulb">💡</span> NUEVO TICKET #${number}
        </div>
        <button type="button" id="fixea-close-btn" class="fixea-close-btn">&times;</button>
      </div>

      <div class="fixea-modal-info">
        <div class="fixea-info-row">
          <span>Herramienta:</span>
          <span class="fixea-gray">${TOOL_LABEL[ann.type] || "Pluma"}</span>
        </div>
        <div class="fixea-info-row">
          <span>Punto seleccionado:</span>
          <span class="fixea-cyan">X: ${ann.coords.x}px | Y: ${ann.coords.y}px</span>
        </div>
        <div class="fixea-info-row">
          <span>Pantalla:</span>
          <span class="fixea-gray">${window.innerWidth}x${window.innerHeight}</span>
        </div>
      </div>

      <textarea id="fixea-ticket-text" placeholder="Escribí tu observación aquí..." rows="3"></textarea>

      <div class="fixea-modal-footer">
        <div class="fixea-priority">
          <span>Prioridad:</span> <strong class="fixea-high">Alta</strong>
        </div>
        <button type="button" id="fixea-send-btn" class="fixea-send-btn">
          <span>ENVIAR TICKET</span>
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    pending = { ann, modalEl: modal };

    const textInput = modal.querySelector("#fixea-ticket-text");
    const sendBtn = modal.querySelector("#fixea-send-btn");
    setTimeout(() => textInput && textInput.focus(), 100);

    modal.querySelector("#fixea-close-btn").addEventListener("click", () => {
      if (pending && pending.modalEl === modal) discardPending();
      else modal.remove();
    });

    sendBtn.addEventListener("click", () => {
      const titleText = textInput.value.trim();
      if (!titleText) {
        textInput.focus();
        return;
      }

      // El número se recalcula al guardar (puede haber cambiado si se borraron anotaciones)
      const ticketNumber = nextTicketNumber();

      const ticket = {
        id: ann.id,
        number: ticketNumber,
        type: ann.type,
        color: ann.color,
        shape: ann.shape,
        project: location.hostname,
        title: titleText,
        priority: "Alta",
        status: "PENDIENTE",
        author: "Cliente",
        coords: ann.coords,
        url: pageKey(),
        createdAt: new Date().toISOString(),
        synced: false,
      };

      saveTicket(ticket);
      syncTicket(ticket);

      // La anotación queda guardada: la goma / deshacer ya la pueden borrar de localStorage
      ann.title = titleText;
      if (ann.type === "sticker") drawShape(ann); // la nota muestra el texto del ticket
      syncBadgeNumbers([{ id: ann.id, number: ticketNumber }]);
      pending = null;

      sendBtn.textContent = "¡ENVIADO!";
      sendBtn.style.background = "#00ff66";
      sendBtn.style.color = "#000";
      sendBtn.disabled = true;

      setTimeout(() => modal.remove(), 800);
    });
  }

  // ---- Arranque ----
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFixeaExtension, { once: true });
  } else {
    initFixeaExtension();
  }
})();