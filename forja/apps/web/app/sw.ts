import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";
import { defaultCache } from "@serwist/next/worker";
import { FLUSH_MESSAGE, OUTBOX_SYNC_TAG } from "@/lib/offline/background-sync";
import { DESCANSO_CANCEL_MESSAGE, DESCANSO_MESSAGE, crearProgramadorDescanso } from "@/lib/offline/descanso-sw";

/**
 * Service Worker FORJA - politica de cache del plan de diseno / arquitectura §6.
 * - App shell: precache (lo inyecta Serwist en build).
 * - Catalogo de ejercicios: Stale-While-Revalidate (lectura offline).
 * - Media del catalogo (Supabase Storage): Cache-First con expiracion LRU.
 * - Recompensas pendientes (/me/rewards): Network-Only. Una copia en cache
 *   resucitaria celebraciones ya confirmadas.
 * - Resto de GETs a la API: Network-First con fallback.
 * - Mutaciones: NUNCA pasan por el SW; viven en el outbox de IndexedDB.
 * - Background Sync: el SW despierta al volver la conexion y avisa a los
 *   clientes para que vacien el outbox (ver `lib/offline/background-sync.ts`).
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url, request }) =>
        request.method === "GET" && apiUrl !== "" && url.href.startsWith(`${apiUrl}/exercises`),
      handler: new StaleWhileRevalidate({ cacheName: "forja-catalogo" }),
    },
    {
      matcher: ({ url, request }) =>
        request.method === "GET" && url.pathname.includes("/storage/v1/object/"),
      handler: new CacheFirst({
        cacheName: "forja-media",
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
    {
      matcher: ({ url }) => apiUrl !== "" && url.href.startsWith(`${apiUrl}/me/rewards`),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url, request }) =>
        request.method === "GET" && apiUrl !== "" && url.href.startsWith(apiUrl),
      handler: new NetworkFirst({ cacheName: "forja-api", networkTimeoutSeconds: 4 }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();

/**
 * Background Sync (semanas 10-11). El POST necesita el Bearer de la sesion de
 * Supabase, que solo existe en la pagina: aqui unicamente despertamos a los
 * clientes abiertos para que llamen a `flushOutbox`. Si no hay ninguno,
 * rechazamos a proposito para que el navegador reintente el `sync` mas tarde,
 * cuando el usuario vuelva a abrir la app.
 */
self.addEventListener("sync", (event) => {
  const syncEvent = event as ExtendableEvent & { tag?: string };
  if (syncEvent.tag !== OUTBOX_SYNC_TAG) return;
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.length === 0) throw new Error("sin clientes: reintentar el sync");
      for (const client of clients) client.postMessage({ type: FLUSH_MESSAGE });
    })(),
  );
});

/**
 * Aviso de fin de descanso (unico notificador: `new Notification` es ilegal en
 * Android Chrome). Chrome corta los eventos extendibles a ~5 min, asi que un
 * descanso mas largo puede no avisar en segundo plano; y en iOS el SO suspende
 * el SW al backgroundear la PWA, donde el aviso solo sale al volver a la app.
 */
const programadorDescanso = crearProgramadorDescanso({
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as number),
  hayClienteVisible: async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    return clients.some((c) => c.visibilityState === "visible" && c.focused);
  },
  mostrar: () =>
    self.registration.showNotification("Descanso terminado", {
      body: "Es hora de la siguiente serie.",
      tag: "forja-descanso",
      renotify: true,
      vibrate: [200, 100, 200],
      icon: "/icons/icon-192.png",
    } as NotificationOptions),
});

self.addEventListener("message", (event) => {
  const data = event.data as { type?: string; endsAt?: number } | undefined;
  if (data?.type === DESCANSO_MESSAGE && typeof data.endsAt === "number") {
    event.waitUntil(programadorDescanso.programar(data.endsAt));
  } else if (data?.type === DESCANSO_CANCEL_MESSAGE) {
    programadorDescanso.cancelar();
  }
});

/* Tap en el aviso: enfocar la ventana abierta (la de /sesion si la hay) o abrirla. */
self.addEventListener("notificationclick", (event) => {
  if (event.notification.tag !== "forja-descanso") return;
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const destino = clients.find((c) => new URL(c.url).pathname === "/sesion") ?? clients[0];
      if (destino) await destino.focus();
      else await self.clients.openWindow("/sesion");
    })(),
  );
});
