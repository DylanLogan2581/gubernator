import { describe, expect, it } from "vitest";

import type { WorldCalendarConfig } from "@/features/calendar";
import { createAccessContext } from "@/features/permissions";

import {
  createWorldSlug,
  formatLastTurnLabel,
  formatPlayerCharacterCount,
  toAccessibleWorld,
} from "./worldDisplay";

describe("formatPlayerCharacterCount", () => {
  it("reports an empty state when there are no player characters", () => {
    expect(formatPlayerCharacterCount(0)).toBe("No player characters");
  });

  it("uses the singular noun for a single player character", () => {
    expect(formatPlayerCharacterCount(1)).toBe("1 player character");
  });

  it("uses the plural noun for multiple player characters", () => {
    expect(formatPlayerCharacterCount(4)).toBe("4 player characters");
  });
});

describe("formatLastTurnLabel", () => {
  it("reports an empty state when the world never transitioned", () => {
    expect(formatLastTurnLabel(null)).toBe("Never");
  });

  it("formats the last transition as a relative time", () => {
    const now = new Date("2026-07-25T00:00:00Z");
    expect(formatLastTurnLabel("2026-07-22T00:00:00Z", now)).toBe("3 days ago");
  });
});

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
      inWorldDateLabel: "Firstday, Ember 1, 100 AG",
      inWorldDateLabelShort: "2/1/100",
      isArchived: false,
      nextInWorldDateLabel: "Secondday, Ember 2, 100 AG",
      nextTurnNumber: 4,
      planningTurnNumber: 3,
      slug: "verdant-reach-world1",
    });
  });

  it("maps stored turn zero to the first planning date and next calendar day", () => {
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: ["world-1"],
    });

    const world = toAccessibleWorld(
      createWorldRow({ current_turn_number: 0 }),
      accessContext,
    );

    expect(world).toMatchObject({
      currentTurnNumber: 0,
      inWorldDateLabel: "Firstday, Dawn 1, 100 AG",
      inWorldDateLabelShort: "1/1/100",
      nextInWorldDateLabel: "Secondday, Dawn 2, 100 AG",
      nextTurnNumber: 1,
      planningTurnNumber: 1,
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

  it("marks archived worlds for display", () => {
    const accessContext = createAccessContext({
      isSuperAdmin: false,
      userId: "user-1",
      worldAdminWorldIds: ["world-2"],
    });

    const world = toAccessibleWorld(
      createWorldRow({
        archived_at: "2026-01-03T00:00:00.000Z",
        id: "world-2",
        name: "Archived World",
        status: "archived",
      }),
      accessContext,
    );

    expect(world.isArchived).toBe(true);
    expect(world.canAccess).toBe(true);
    expect(world.canManage).toBe(true);
  });
});

function createWorldRow(
  overrides: Partial<{
    readonly archived_at: string | null;
    readonly calendar_config_json: TestCalendarConfigJson;
    readonly created_at: string;
    readonly current_turn_number: number;
    readonly id: string;
    readonly incest_prevention_depth: number;
    readonly is_trashed: boolean;
    readonly name: string;
    readonly status: string;
    readonly updated_at: string;
  }> = {},
): {
  readonly archived_at: string | null;
  readonly calendar_config_json: TestCalendarConfigJson;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
} {
  return {
    archived_at: null,
    calendar_config_json: createCalendarConfig(),
    created_at: "2026-01-01T00:00:00.000Z",
    current_turn_number: 3,
    id: "world-1",
    incest_prevention_depth: 4,
    is_trashed: false,
    name: "Verdant Reach",
    status: "active",
    updated_at: "2026-01-02T00:00:00.000Z",
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
    dateFormatTemplate: "{weekday}, {month} {day}, {year} AG",
    shortDateFormatTemplate: "{monthNumber}/{dayNumber}/{yearNumber}",
  };
}
