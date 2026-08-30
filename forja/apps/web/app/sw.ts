import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";
import { defaultCache } from "@serwist/next/worker";

/**
 * Service Worker FORJA - politica de cache del plan de diseno / arquitectura §6.
 * - App shell: precache (lo inyecta Serwist en build).
 * - Catalogo de ejercicios: Stale-While-Revalidate (lectura offline).
 * - Media del catalogo (Supabase Storage): Cache-First con expiracion LRU.
 * - Resto de GETs a la API: Network-First con fallback.
 * - Mutaciones: NUNCA pasan por el SW; viven en el outbox de IndexedDB.
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
      matcher: ({ url, request }) =>
        request.method === "GET" && apiUrl !== "" && url.href.startsWith(apiUrl),
      handler: new NetworkFirst({ cacheName: "forja-api", networkTimeoutSeconds: 4 }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
