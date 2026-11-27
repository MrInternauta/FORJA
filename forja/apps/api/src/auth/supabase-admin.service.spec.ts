import { BadGatewayException, Logger } from "@nestjs/common";
import { SupabaseAdminService } from "./supabase-admin.service";

// env.ts sale del proceso si falta DATABASE_URL: en unit tests se sustituye.
jest.mock("../config/env", () => ({ env: { SUPABASE_URL: "http://supa.test" } }));

const USER = "11111111-1111-4111-8111-111111111111";

describe("SupabaseAdminService.deleteUser", () => {
  const fetchMock = jest.fn();
  let warn: jest.SpyInstance;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const make = (serviceRoleKey?: string) =>
    new SupabaseAdminService({ url: "http://supa.test", serviceRoleKey });

  it("sin clave: no llama a Supabase, avisa en el log y devuelve false", async () => {
    await expect(make(undefined).deleteUser(USER)).resolves.toBe(false);
    await expect(make("").deleteUser(USER)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("con clave: DELETE a la Admin API con la service role key", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    await expect(make("srk").deleteUser(USER)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`http://supa.test/auth/v1/admin/users/${USER}`);
    expect(init.method).toBe("DELETE");
    expect(init.headers).toEqual({ apikey: "srk", Authorization: "Bearer srk" });
  });

  it("404 cuenta como ya borrado (idempotente)", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(make("srk").deleteUser(USER)).resolves.toBe(true);
  });

  it("error de Supabase → 502 legible", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(make("srk").deleteUser(USER)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it("red caida → 502 legible", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const err = await make("srk").deleteUser(USER).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadGatewayException);
    expect((err as BadGatewayException).message).toMatch(/No pudimos borrar tu cuenta/);
  });
});
