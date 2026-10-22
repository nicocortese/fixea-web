# Deuda técnica conocida

Ítems identificados durante la iteración de sync API, dashboard y extensión. No bloquean la entrega actual, pero deben resolverse antes de un entorno productivo.

## 1. Autenticación y autorización

- `/` exige sesión con rol `dev` y `/cliente` exige sesión, validadas en `proxy.js` con un JWT httpOnly (`fixea_token`).
- La API (`/api/tickets`, `/api/tickets/[id]`, `/api/projects`) no valida sesión ni rol: el `POST /api/tickets` debe seguir público para que la extensión pueda enviar tickets sin cookies.
- El alta de `dev` requiere `DEV_INVITE_CODE` cuando la variable está configurada; el rol se elige en el formulario, pero sin el código no se obtiene sesión de desarrollador.
- Las sesiones son JWT stateless de 7 días: cerrar sesión borra la cookie, pero un token copiado sigue siendo válido hasta que expira.
- Login y registro no tienen rate limiting.
- **Riesgo:** cualquier cliente puede leer, modificar o borrar tickets y screenshots (la API no valida sesión).
- **Siguiente paso:** autorización por rol en las APIs de lectura/escritura (con un token propio para la extensión), revocación de sesiones y rate limiting en login/registro.

## 2. Migración de tickets históricos

- El esquema anterior guardaba `status: "open"` / `priority: "medium"` y no incluía `project`.
- El dashboard actual filtra por estados `PENDIENTE`, `EN_PROCESO`, `FINALIZADO` y requiere `project` para agrupar.
- **Riesgo:** tickets viejos quedan invisibles aunque sigan en MongoDB.
- **Siguiente paso:** script de migración/backfill y fallback para registros sin proyecto.

## 3. Persistencia offline de la extensión

- La cola de tickets y los screenshots viven en `localStorage` del sitio visitado.
- El límite de ~5 MB se puede alcanzar rápido con capturas JPEG; los errores de cuota se silencian.
- La cola es por origen, por lo que un ticket pendiente en un sitio no se reintenta desde otro.
- **Siguiente paso:** mover cola y capturas a `chrome.storage.local` o IndexedDB, con límite y limpieza.

## 4. Captura de screenshots en páginas scrolleadas

- `chrome.tabs.captureVisibleTab` captura solo el viewport visible.
- Las coordenadas de las anotaciones son de página (`pageX` / `pageY`).
- **Riesgo:** en páginas con scroll, la miniatura no coincide con la posición marcada.
- **Siguiente paso:** compensar el scroll al dibujar la anotación o capturar la página completa.

## 5. Tamaño de listados con screenshots

- `GET /api/tickets` devuelve todos los tickets con el screenshot embebido como data URL.
- **Riesgo:** payloads grandes y mayor uso de memoria a medida que crece el historial.
- **Siguiente paso:** almacenar imágenes en GridFS/S3, devolver solo una miniatura y paginar el listado.

## 6. Fallback offline del portal cliente

- Si `POST /api/tickets` responde 4xx/5xx, el ticket no se guarda localmente (solo se conserva si falla la red).
- **Riesgo:** pérdida de la observación escrita por el cliente ante un rechazo del servidor.
- **Siguiente paso:** persistir siempre en la cola local y reintentar la sincronización.

## 7. Límite de capturas de Chrome

- Chrome permite aproximadamente dos capturas por segundo.
- La sincronización de varios tickets pendientes puede disparar capturas en paralelo.
- **Siguiente paso:** serializar capturas con backoff y reutilizar la captura guardada.
