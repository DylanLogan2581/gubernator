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
    expect(context.canAdminWorld("world-1")).toBe(true);
    expect(context.canManageWorld({ id: "world-1" })).toBe(true);
  });

  it("allows world admins to access and manage assigned worlds", () => {
    const context = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    expect(context.canAccessWorld({ id: "world-1" })).toBe(true);
    expect(context.canAdminWorld("world-1")).toBe(true);
    expect(context.canManageWorld({ id: "world-1" })).toBe(true);
    expect(context.canAccessWorld({ id: "world-2" })).toBe(false);
  });

  it("allows world owners to access and manage owned worlds", () => {
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
    expect(context.canAdminWorld("world-1")).toBe(false);
  });
});
