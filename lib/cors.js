// Headers comunes de las rutas que consume la extensión de Chrome.
// `Access-Control-Allow-Private-Network` habilita el preflight de Private
// Network Access de Chrome cuando un sitio público (https://...vercel.app)
// termina hablando con el servidor local (http://localhost:3000).
export const PRIVATE_NETWORK_HEADERS = {
  "Access-Control-Allow-Private-Network": "true",
};

export const EXTENSION_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Fixea-Project-Key",
  "Access-Control-Max-Age": "86400",
  ...PRIVATE_NETWORK_HEADERS,
};

// Envuelve un handler de ruta y agrega los headers a TODAS sus respuestas,
// incluidas las de error, sin tocar cada `NextResponse.json`.
export function withHeaders(handler, headers = PRIVATE_NETWORK_HEADERS) {
  return async (...args) => {
    const response = await handler(...args);
    for (const [name, value] of Object.entries(headers)) {
      response.headers.set(name, value);
    }
    return response;
  };
}
