import { describe, expect, it } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";
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

    const world = toAccessibleWorld(createWorldRow(), accessContext);

    expect(world).toMatchObject({
      canAccess: true,
      canAdmin: true,
      canManage: true,
      currentTurnNumber: 3,
      inWorldDateLabel: "Ember 1, 100 AG",
      isArchived: false,
      isHidden: true,
      nextFullInWorldDateLabel: "Secondday, Ember 2, 100 AG",
      nextInWorldDateLabel: "Ember 2, 100 AG",
      nextTurnNumber: 4,
      ownerId: "user-2",
      planningTurnNumber: 3,
      slug: "local-development-world-world1",
    });
  });

  it("falls back when calendar config is missing or invalid", () => {
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    expect(
      toAccessibleWorld(
        createWorldRow({ calendar_config_json: null }),
        accessContext,
      ).inWorldDateLabel,
    ).toBe("Calendar unavailable");
    expect(
      toAccessibleWorld(
        createWorldRow({ calendar_config_json: { months: [] } }),
        accessContext,
      ).inWorldDateLabel,
    ).toBe("Calendar unavailable");
  });

  it("marks archived public worlds for display", () => {
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: [],
    });

    const world = toAccessibleWorld(
      createWorldRow({
        archived_at: "2026-01-03T00:00:00.000Z",
        id: "world-2",
        name: "Archived World",
        status: "archived",
        visibility: "public",
      }),
      accessContext,
    );

    expect(world.isArchived).toBe(true);
    expect(world.isHidden).toBe(false);
    expect(world.canAccess).toBe(true);
    expect(world.canManage).toBe(false);
  });
});

function createWorldRow(
  overrides: Partial<{
    readonly archived_at: string | null;
    readonly calendar_config_json: TestCalendarConfigJson;
    readonly created_at: string;
    readonly current_turn_number: number;
    readonly id: string;
    readonly name: string;
    readonly owner_id: string;
    readonly status: string;
    readonly updated_at: string;
    readonly visibility: string;
  }> = {},
): {
  readonly archived_at: string | null;
  readonly calendar_config_json: TestCalendarConfigJson;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly name: string;
  readonly owner_id: string;
  readonly status: string;
  readonly updated_at: string;
  readonly visibility: string;
} {
  return {
    archived_at: null,
    calendar_config_json: createCalendarConfig(),
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 3,
    id: "world-1",
    name: "Local Development World",
    owner_id: "user-2",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
    visibility: "private",
    ...overrides,
  };
}

type TestCalendarConfigJson =
  | WorldCalendarConfig
  | { readonly months: [] }
  | null;

function createCalendarConfig(): WorldCalendarConfig {
  return {
    months: [
      { dayCount: 2, index: 0, name: "Dawn" },
      { dayCount: 3, index: 1, name: "Ember" },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 100,
    weekdays: [
      { index: 0, name: "Firstday" },
      { index: 1, name: "Secondday" },
    ],
    yearFormatTemplate: "{n} AG",
  };
}
