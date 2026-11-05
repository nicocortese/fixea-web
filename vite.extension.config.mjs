import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

const DEV_API_BASE = "http://localhost:3000";

// Normaliza la URL del backend y falla rápido si falta en producción, para no
// publicar una extensión que apunte silenciosamente a localhost.
function resolveApiBase(mode, rawValue) {
  const value = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!value) {
    if (mode === "development") return DEV_API_BASE;

    throw new Error(
      `[fixea-extension] Falta VITE_FIXEA_API_BASE para el modo "${mode}". ` +
        `Definila en .env.${mode} o en .env.${mode}.local.`,
    );
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw new Error(
      `[fixea-extension] VITE_FIXEA_API_BASE no es una URL válida: "${value}"`,
    );
  }

  if (parsed.pathname && parsed.pathname !== "/") {
    throw new Error(
      `[fixea-extension] VITE_FIXEA_API_BASE no puede incluir un path ` +
        `("${parsed.pathname}"). Usá sólo el origen, ej: https://tu-dominio.com`,
    );
  }

  if (mode === "production") {
    const hostname = parsed.hostname.toLowerCase();
    const isPlaceholder =
      hostname === "example.com" || hostname.endsWith(".example.com");
    const isLoopback =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]";

    if (isPlaceholder) {
      throw new Error(
        "[fixea-extension] VITE_FIXEA_API_BASE sigue siendo un placeholder " +
          "(example.com). Configurá el dominio real en .env.production o " +
          "en .env.production.local antes de compilar para producción.",
      );
    }

    if (isLoopback) {
      throw new Error(
        "[fixea-extension] Un build de producción no puede apuntar a " +
          `${parsed.origin}. Configurá el dominio real en .env.production.local.`,
      );
    }
  }

  return parsed.origin;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiBase = resolveApiBase(mode, env.VITE_FIXEA_API_BASE);

  console.log(`[fixea-extension] Build "${mode}" → API base: ${apiBase}`);

  return {
    // El public/ del sitio web (svgs, logos) no pertenece a la extensión.
    publicDir: false,
    // Se inyecta como constante en build-time: el service worker (script
    // clásico) y los content scripts no pueden leer process.env en runtime.
    define: {
      __FIXEA_API_BASE__: JSON.stringify(apiBase),
    },
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: "extension/manifest.json", dest: ".", rename: { stripBase: 1 } },
          { src: "extension/content.css", dest: ".", rename: { stripBase: 1 } },
          { src: "extension/popup.html", dest: ".", rename: { stripBase: 1 } },
          { src: "extension/icons/**/*", dest: "icons", rename: { stripBase: 2 } },
        ],
      }),
    ],
    build: {
      outDir: "dist-extension",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          content: resolve(__dirname, "extension/content.jsx"),
          background: resolve(__dirname, "extension/background.js"),
          popup: resolve(__dirname, "extension/popup.js"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "[name].[ext]",
        },
      },
    },
  };
});
