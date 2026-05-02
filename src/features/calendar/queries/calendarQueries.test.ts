import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  WorldCalendarConfigError,
  isWorldCalendarConfigError,
  shouldRetryWorldCalendarConfigQuery,
  worldCalendarConfigQueryOptions,
} from "./calendarQueries";

describe("worldCalendarConfigQueryOptions", () => {
  it("loads and validates one RLS-visible world calendar config", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { calendar_config_json: createCalendarConfig() },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();

    const config = await queryClient.fetchQuery(
      worldCalendarConfigQueryOptions("world-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(config).toEqual(createCalendarConfig());
    expect(from).toHaveBeenCalledWith("worlds");
    expect(select).toHaveBeenCalledWith("calendar_config_json");
    expect(eq).toHaveBeenCalledWith("id", "world-1");
    expect(maybeSingle).toHaveBeenCalledWith();
  });

  it("uses world-scoped query keys", () => {
    const options = worldCalendarConfigQueryOptions(
      "world-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "calendar",
      "world-calendar-config",
      "world-1",
    ]);
  });

  it("returns a UI-safe error when the config is invalid", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        calendar_config_json: {
          ...createCalendarConfig(),
          startingWeekdayOffset: 99,
        },
      },
      error: null,
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        worldCalendarConfigQueryOptions(
          "world-1",
          createClient({ maybeSingle }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "world_calendar_config_invalid",
      message: "Calendar configuration is invalid.",
      name: "WorldCalendarConfigError",
      worldId: "world-1",
    });
  });

  it("returns a UI-safe error when RLS hides the world or the config is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        worldCalendarConfigQueryOptions(
          "world-1",
          createClient({ maybeSingle }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "world_calendar_config_missing",
      message: "Calendar configuration is unavailable.",
      name: "WorldCalendarConfigError",
      worldId: "world-1",
    });
  });

  it("returns a UI-safe error when the config column value is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { calendar_config_json: null },
      error: null,
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        worldCalendarConfigQueryOptions(
          "world-1",
          createClient({ maybeSingle }),
        ),
      ),
    ).rejects.toSatisfy(isWorldCalendarConfigError);
  });

  it("normalizes Supabase errors", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "permission denied for table worlds",
      },
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        worldCalendarConfigQueryOptions(
          "world-1",
          createClient({ maybeSingle }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "permission denied for table worlds",
      name: "AuthUiError",
    });
  });

  it("does not retry invalid or missing calendar config results", () => {
    expect(
      shouldRetryWorldCalendarConfigQuery(
        0,
        new WorldCalendarConfigError({
          code: "world_calendar_config_invalid",
          message: "Calendar configuration is invalid.",
          worldId: "world-1",
        }),
      ),
    ).toBe(false);
    expect(
      shouldRetryWorldCalendarConfigQuery(0, new AuthUiError({ message: "" })),
    ).toBe(true);
    expect(
      shouldRetryWorldCalendarConfigQuery(3, new AuthUiError({ message: "" })),
    ).toBe(false);
  });
});

function createClient({
  maybeSingle,
}: {
  readonly maybeSingle: ReturnType<typeof vi.fn>;
}): GubernatorSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  } as unknown as GubernatorSupabaseClient;
}

function createCalendarConfig(): {
  readonly months: readonly [
    {
      readonly dayCount: 30;
      readonly index: 0;
      readonly name: "Frostmonth";
    },
  ];
  readonly startingDayOfMonth: 1;
  readonly startingMonthIndex: 0;
  readonly startingWeekdayOffset: 0;
  readonly startingYear: 1;
  readonly weekdays: readonly [
    {
      readonly index: 0;
      readonly name: "Moonday";
    },
  ];
  readonly yearFormatTemplate: "Year {n}";
} {
  return {
    months: [
      {
        dayCount: 30,
        index: 0,
        name: "Frostmonth",
      },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 1,
    weekdays: [
      {
        index: 0,
        name: "Moonday",
      },
    ],
    yearFormatTemplate: "Year {n}",
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
