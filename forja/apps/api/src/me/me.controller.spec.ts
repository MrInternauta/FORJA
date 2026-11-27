import { BadGatewayException } from "@nestjs/common";
import { MeController } from "./me.controller";
import type { MeService } from "./me.service";
import type { DatabaseService } from "../database/database.service";
import type { SupabaseAdminService } from "../auth/supabase-admin.service";

// env.ts sale del proceso si falta DATABASE_URL: en unit tests se sustituye.
jest.mock("../config/env", () => ({ env: { SUPABASE_URL: "http://supa.test" } }));

const user = { id: "11111111-1111-4111-8111-111111111111", role: "FREE" } as const;

describe("MeController.deleteMe", () => {
  const make = (deleteUser: jest.Mock) => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    const ctrl = new MeController(
      {} as MeService,
      db as unknown as DatabaseService,
      { deleteUser } as unknown as SupabaseAdminService,
    );
    return { ctrl, db };
  };

  it("borra el usuario de auth y luego el perfil", async () => {
    const deleteUser = jest.fn().mockResolvedValue(true);
    const { ctrl, db } = make(deleteUser);
    await ctrl.deleteMe(user);
    expect(deleteUser).toHaveBeenCalledWith(user.id);
    expect(db.query).toHaveBeenCalledWith("delete from public.profiles where id = $1", [user.id]);
    expect(deleteUser.mock.invocationCallOrder[0]).toBeLessThan(db.query.mock.invocationCallOrder[0]);
  });

  it("sin service role key se comporta como antes: borra el perfil", async () => {
    const { ctrl, db } = make(jest.fn().mockResolvedValue(false));
    await ctrl.deleteMe(user);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("si la Admin API falla no borra nada (se puede reintentar)", async () => {
    const { ctrl, db } = make(jest.fn().mockRejectedValue(new BadGatewayException("x")));
    await expect(ctrl.deleteMe(user)).rejects.toBeInstanceOf(BadGatewayException);
    expect(db.query).not.toHaveBeenCalled();
  });
});
