// IndexedDB en Node para poder ejercitar Dexie de verdad (sin mockear el store).
import "fake-indexeddb/auto";
import { vi } from "vitest";

// El outbox consulta `navigator.onLine`; en Node no existe salvo que lo pongamos.
if (typeof globalThis.navigator === "undefined") {
  vi.stubGlobal("navigator", { onLine: true });
}
