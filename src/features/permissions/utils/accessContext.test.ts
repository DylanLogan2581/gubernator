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
    ).toBe(true);
  });

  it("allows super admins to access and manage any world", () => {
    const context = createAccessContext({
      isSuperAdmin: true,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    expect(context.canAccessWorld({ id: "world-1" })).toBe(true);
    expect(context.canAdminWorld({ id: "world-1" })).toBe(true);
    expect(context.canManageWorld({ id: "world-1" })).toBe(true);
  });

  it("allows explicit world admins to access and manage assigned worlds", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    expect(context.canAccessWorld({ id: "world-1" })).toBe(true);
    expect(context.canAdminWorld({ id: "world-1" })).toBe(true);
    expect(context.canManageWorld({ id: "world-1" })).toBe(true);
    expect(context.canAccessWorld({ id: "world-2" })).toBe(false);
  });

  it("treats world owners as world admins for frontend capability checks", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    expect(context.canAccessWorld({ id: "world-1", ownerId: "user-1" })).toBe(
      true,
    );
    expect(context.canManageWorld({ id: "world-1", ownerId: "user-1" })).toBe(
      true,
    );
    expect(context.canAdminWorld({ id: "world-1", ownerId: "user-1" })).toBe(
      true,
    );
    expect(context.canAdminWorld({ id: "world-2", ownerId: "user-2" })).toBe(
      false,
    );
  });

  it("does not grant private world capabilities to outsiders", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const outsiderWorld = {
      id: "world-1",
      ownerId: "user-2",
      visibility: "private",
    };

    expect(context.canAccessWorld(outsiderWorld)).toBe(false);
    expect(context.canAdminWorld(outsiderWorld)).toBe(false);
    expect(context.canManageWorld(outsiderWorld)).toBe(false);
  });

  it("does not grant capabilities to inactive application users", () => {
    const context = createAccessContext({
      isActiveUser: false,
      isSuperAdmin: true,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    expect(context.isAuthenticated).toBe(true);
    expect(context.isActiveUser).toBe(false);
    expect(context.isSuperAdmin).toBe(false);
    expect(context.worldAdminWorldIds).toEqual([]);
    expect(context.canAccessWorld({ id: "world-1" })).toBe(false);
    expect(
      context.canAccessWorld({ id: "public-world", visibility: "public" }),
    ).toBe(false);
    expect(context.canManageWorld({ id: "world-2", ownerId: "user-1" })).toBe(
      false,
    );
    expect(context.canAdminWorld({ id: "world-1" })).toBe(false);
  });
});
