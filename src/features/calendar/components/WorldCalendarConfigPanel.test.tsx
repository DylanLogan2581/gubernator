import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAccessContext,
  type AccessContext,
} from "@/features/permissions";

import { WorldCalendarConfigPanel } from "./WorldCalendarConfigPanel";

import type { WorldCalendarConfig } from "../schemas/calendarConfigSchemas";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

describe("WorldCalendarConfigPanel", () => {
  beforeEach(() => {
    requireSupabaseClient.mockReset();
  });

  it("renders editable calendar controls for world admins", async () => {
    const user = userEvent.setup();

    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [createWorldRow()],
      }),
    );

    renderWorldCalendarConfigPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [],
      }),
      canAdmin: true,
      isArchived: false,
    });

    expect(
      await screen.findByRole("heading", { name: "Calendar" }),
    ).toBeDefined();
    expect(
      screen.getByRole("textbox", { name: "Weekdays 1 Name" }),
    ).toHaveValue("Firstday");
    expect(screen.getByRole("textbox", { name: "Months 1 Name" })).toHaveValue(
      "Dawn",
    );
    expect(
      screen.getByRole("spinbutton", { name: "Months 1 Days" }),
    ).toHaveValue(2);
    expect(screen.getByRole("spinbutton", { name: "Day" })).toHaveValue(1);
    expect(screen.getByRole("spinbutton", { name: "Year" })).toHaveValue(100);
    expect(screen.getByLabelText("Month")).toHaveValue("0");
    expect(screen.getByLabelText("Weekday offset")).toHaveValue("0");
    expect(
      screen.getByRole("textbox", { name: "Year format template" }),
    ).toHaveValue("{n} AG");

    await user.clear(screen.getByRole("textbox", { name: "Weekdays 1 Name" }));
    await user.type(
      screen.getByRole("textbox", { name: "Weekdays 1 Name" }),
      "Moonday",
    );

    expect(
      screen.getByRole("textbox", { name: "Weekdays 1 Name" }),
    ).toHaveValue("Moonday");
    expect(screen.getByRole("button", { name: "Add weekday" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add month" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Save calendar" })).toBeDefined();
  });

  it("renders calendar configuration without edit controls for non-admin users", async () => {
    requireSupabaseClient.mockReturnValue(
      createClient({
        worldRows: [createWorldRow()],
      }),
    );

    renderWorldCalendarConfigPanel({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "reader-1",
        worldAdminWorldIds: [],
      }),
      canAdmin: false,
      isArchived: false,
    });

    expect(
      await screen.findByRole("heading", { name: "Calendar" }),
    ).toBeDefined();
    expect(screen.getByText("Read-only")).toBeDefined();
    expect(screen.getAllByText("Firstday")).toHaveLength(2);
    expect(screen.getByText("Dawn (2 days)")).toBeDefined();
    expect(screen.getByText("Dawn 1, 100")).toBeDefined();
    expect(screen.getByText("{n} AG")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Save calendar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add weekday" })).toBeNull();
    expect(
      screen.queryByRole("textbox", { name: "Weekdays 1 Name" }),
    ).toBeNull();
  });
});

function renderWorldCalendarConfigPanel({
  accessContext,
  canAdmin,
  isArchived,
}: {
  readonly accessContext: AccessContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
}): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <WorldCalendarConfigPanel
        accessContext={accessContext}
        canAdmin={canAdmin}
        isArchived={isArchived}
        worldId="00000000-0000-0000-0000-000000000001"
      />
    </QueryClientProvider>,
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function createClient({
  worldRows,
}: {
  readonly worldRows: readonly TestWorldRow[];
}): unknown {
  return {
    from: vi.fn((table: string) => {
      if (table === "worlds") {
        return createWorldsQueryBuilder(worldRows);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

type TestWorldRow = {
  readonly calendar_config_json: WorldCalendarConfig;
  readonly id: string;
};

function createWorldRow(overrides: Partial<TestWorldRow> = {}): TestWorldRow {
  return {
    calendar_config_json: createCalendarConfig(),
    id: "00000000-0000-0000-0000-000000000001",
    ...overrides,
  };
}

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

function createWorldsQueryBuilder(rows: readonly TestWorldRow[]): unknown {
  return {
    select: vi.fn(() => ({
      eq: vi.fn((column: string, value: string) => {
        const data =
          column === "id"
            ? (rows.find((row) => row.id === value) ?? null)
            : null;

        return {
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        };
      }),
    })),
  };
}
