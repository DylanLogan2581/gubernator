import { describe, expect, it } from "vitest";

import { createAccessContext } from "./accessContext";

describe("createAccessContext", () => {
  it("creates an anonymous access context", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: null,
      worldAdminWorldIds: [],
    });

    expect(context.isAuthenticated).toBe(false);
    expect(context.isSuperAdmin).toBe(false);
    expect(context.canAccessWorld({ id: "private-world" })).toBe(false);
    expect(
      context.canAccessWorld({ id: "public-world", visibility: "public" }),
    ).toBe(false);
  });

  it("does not grant anonymous access to private or public worlds", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: null,
      worldAdminWorldIds: [],
    });

    expect(
      context.canAccessWorld({
        id: "private-world",
        visibility: "private",
      }),
    ).toBe(false);
    expect(
      context.canAccessWorld({
        id: "public-world",
        visibility: "public",
      }),
    ).toBe(false);
  });

  it("allows super admins to access and admin any world", () => {
    const context = createAccessContext({
      isSuperAdmin: true,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    expect(context.canAccessWorld({ id: "world-1" })).toBe(true);
    expect(context.canAdminWorld({ id: "world-1" })).toBe(true);
  });

  it("allows explicit world admins to access and admin assigned worlds", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    expect(context.canAccessWorld({ id: "world-1" })).toBe(true);
    expect(context.canAdminWorld({ id: "world-1" })).toBe(true);
    expect(context.canAccessWorld({ id: "world-2" })).toBe(false);
  });

  it("does not grant private world capabilities to outsiders", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const outsiderWorld = {
      id: "world-1",
      visibility: "private",
    };

    expect(context.canAccessWorld(outsiderWorld)).toBe(false);
    expect(context.canAdminWorld(outsiderWorld)).toBe(false);
  });

  it("allows player-character world holders to access their worlds", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
      playerCharacterWorldIds: ["world-pc"],
    });

    expect(context.canAccessWorld({ id: "world-pc" })).toBe(true);
    expect(context.canAdminWorld({ id: "world-pc" })).toBe(false);
    expect(context.canAccessWorld({ id: "world-other" })).toBe(false);
    expect(context.playerCharacterWorldIds).toEqual(["world-pc"]);
  });

  it("does not grant capabilities to inactive application users", () => {
    const context = createAccessContext({
      isActiveUser: false,
      isSuperAdmin: true,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
      playerCharacterWorldIds: ["world-pc"],
    });

    expect(context.isAuthenticated).toBe(true);
    expect(context.isActiveUser).toBe(false);
    expect(context.isSuperAdmin).toBe(false);
    expect(context.worldAdminWorldIds).toEqual([]);
    expect(context.playerCharacterWorldIds).toEqual([]);
    expect(context.canAccessWorld({ id: "world-1" })).toBe(false);
    expect(context.canAccessWorld({ id: "world-pc" })).toBe(false);
    expect(
      context.canAccessWorld({ id: "public-world", visibility: "public" }),
    ).toBe(false);
    expect(context.canAdminWorld({ id: "world-1" })).toBe(false);
  });
});
