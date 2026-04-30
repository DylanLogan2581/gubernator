import { describe, expect, it } from "vitest";

import { createAccessContext } from "@/features/permissions";

import { createWorldSlug, toAccessibleWorld } from "./worldDisplay";

describe("createWorldSlug", () => {
  it("creates stable display slugs from world names", () => {
    expect(
      createWorldSlug(
        "The First World!",
        "00000000-0000-0000-0000-000000000101",
      ),
    ).toBe("the-first-world-00000000");
  });

  it("falls back when the name has no slug characters", () => {
    expect(createWorldSlug("!!!", "10000000-0000-0000-0000-000000000101")).toBe(
      "world-10000000",
    );
  });
});

describe("toAccessibleWorld", () => {
  it("maps database world rows to display fields and permission flags", () => {
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    const world = toAccessibleWorld(
      {
        archived_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        current_turn_number: 3,
        id: "world-1",
        name: "Local Development World",
        owner_id: "user-2",
        status: "active",
        updated_at: "2026-01-02T00:00:00.000Z",
        visibility: "private",
      },
      accessContext,
    );

    expect(world).toMatchObject({
      canAccess: true,
      canAdmin: true,
      canManage: true,
      currentTurnNumber: 3,
      isArchived: false,
      isHidden: true,
      ownerId: "user-2",
      slug: "local-development-world-world1",
    });
  });

  it("marks archived public worlds for display", () => {
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const world = toAccessibleWorld(
      {
        archived_at: "2026-01-03T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        current_turn_number: 3,
        id: "world-2",
        name: "Archived World",
        owner_id: "user-2",
        status: "archived",
        updated_at: "2026-01-02T00:00:00.000Z",
        visibility: "public",
      },
      accessContext,
    );

    expect(world.isArchived).toBe(true);
    expect(world.isHidden).toBe(false);
    expect(world.canAccess).toBe(true);
    expect(world.canManage).toBe(false);
  });
});
