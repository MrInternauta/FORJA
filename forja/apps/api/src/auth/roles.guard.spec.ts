import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { RolesGuard } from "./roles.guard";

function ctxWith(user?: { id: string; role: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  const make = (required?: string[]) => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new RolesGuard(reflector);
  };

  it("permite endpoints sin @Roles", () => {
    expect(make(undefined).canActivate(ctxWith({ id: "u", role: "FREE" }))).toBe(true);
  });

  it("permite cuando el rol coincide", () => {
    expect(make(["ADMIN"]).canActivate(ctxWith({ id: "u", role: "ADMIN" }))).toBe(true);
  });

  it("rechaza FREE en endpoint PRO", () => {
    expect(() => make(["PRO", "ADMIN"]).canActivate(ctxWith({ id: "u", role: "FREE" }))).toThrow(
      ForbiddenException,
    );
  });

  it("rechaza si no hay usuario", () => {
    expect(() => make(["FREE"]).canActivate(ctxWith(undefined))).toThrow(ForbiddenException);
  });
});
