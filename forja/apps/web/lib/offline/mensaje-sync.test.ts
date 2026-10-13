import { describe, expect, it } from "vitest";
import { mensajeSync } from "./mensaje-sync";

describe("mensajeSync", () => {
  it("sin nada que decir no muestra la barra", () => {
    expect(mensajeSync({ phase: "idle", pending: 0, online: true })).toBeNull();
  });

  it("offline concuerda en singular y plural", () => {
    // Regresion: decia "1 sesión guardadas aquí".
    expect(mensajeSync({ phase: "idle", pending: 1, online: false })?.message).toBe("Sin conexión · 1 sesión guardada aquí");
    expect(mensajeSync({ phase: "idle", pending: 2, online: false })?.message).toBe("Sin conexión · 2 sesiones guardadas aquí");
    expect(mensajeSync({ phase: "idle", pending: 0, online: false })?.message).toBe("Sin conexión");
  });

  it("error concuerda en singular y plural", () => {
    expect(mensajeSync({ phase: "error", pending: 1, online: true })?.message).toBe("1 sesión pendiente de subir");
    expect(mensajeSync({ phase: "error", pending: 3, online: true })?.message).toBe("3 sesiones pendientes de subir");
    expect(mensajeSync({ phase: "error", pending: 0, online: true })?.message).toBe("Reintentando la sincronización");
  });

  it("sincronizando y pendiente", () => {
    expect(mensajeSync({ phase: "syncing", pending: 1, online: true })).toEqual({ tono: "syncing", message: "Sincronizando 1 sesión…" });
    expect(mensajeSync({ phase: "idle", pending: 2, online: true })).toEqual({ tono: "pending", message: "2 sesiones por sincronizar" });
  });
});
