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

export function withHeaders(handler, headers = PRIVATE_NETWORK_HEADERS) {
  return async (...args) => {
    const response = await handler(...args);
    for (const [name, value] of Object.entries(headers)) {
      response.headers.set(name, value);
    }
    return response;
  };
}
