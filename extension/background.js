// Evento al instalar o actualizar la extensión
chrome.runtime.onInstalled.addListener(() => {
  console.log("Fixea Extension instalada correctamente.");

  // Inicializar almacenamiento si no existe
  chrome.storage.local.get(["fixea_tickets"], (result) => {
    if (!result.fixea_tickets) {
      chrome.storage.local.set({ fixea_tickets: [] });
    }
  });
});

const DEFAULT_API_BASE = "http://localhost:3000";

function normalizeApiBase(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return (raw || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function getApiBase() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(["fixea_api_base"], (result) => {
        if (chrome.runtime.lastError) {
          resolve(DEFAULT_API_BASE);
          return;
        }
        resolve(normalizeApiBase(result && result.fixea_api_base));
      });
    } catch (error) {
      console.warn("Fixea: no se pudo leer fixea_api_base", error);
      resolve(DEFAULT_API_BASE);
    }
  });
}

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

async function createTicket(payload) {
  const apiBase = await getApiBase();

  const res = await fetch(`${apiBase}/api/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  return { ok: res.ok, status: res.status, data };
}

// Listener para recibir mensajes y coordinar entre popup y content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "get_status") {
    sendResponse({ status: "ok" });
    return false;
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
