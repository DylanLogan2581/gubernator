import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { WorldCalendarConfig } from "@/features/calendar";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  CurrentTurnStateError,
  currentTurnStateQueryOptions,
  isCurrentTurnStateError,
  shouldRetryCurrentTurnStateQuery,
} from "./currentTurnStateQueries";

describe("currentTurnStateQueryOptions", () => {
  it("loads the RLS-visible world turn and formatted in-world date", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        calendar_config_json: createCalendarConfig(),
        current_turn_number: 3,
      },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();

    const turnState = await queryClient.fetchQuery(
      currentTurnStateQueryOptions("world-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(turnState).toEqual({
      calendarConfig: createCalendarConfig(),
      computedDate: {
        dayOfMonth: 1,
        monthIndex: 1,
        monthName: "Rainmonth",
        turnNumber: 3,
        weekdayIndex: 1,
        weekdayName: "Toilsday",
        year: 12,
      },
      currentTurnNumber: 3,
      displayLabels: {
        compactDateLabel: "Toilsday, Rainmonth 1, Year 12",
        dateLabel: "Toilsday, Rainmonth 1, Year 12",
        turnLabel: "Turn 3",
        yearLabel: "12",
      },
      worldId: "world-1",
    });
    expect(from).toHaveBeenCalledWith("worlds");
    expect(select).toHaveBeenCalledWith(
      "current_turn_number,calendar_config_json",
    );
    expect(eq).toHaveBeenCalledWith("id", "world-1");
    expect(maybeSingle).toHaveBeenCalledWith();
  });

  it("uses world-scoped turn query keys", () => {
    const options = currentTurnStateQueryOptions(
      "world-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "turns",
      "current-turn-state",
      "world-1",
    ]);
  });

  it("maps an unstarted world to planning turn one", async () => {
    const queryClient = createQueryClient();

    const turnState = await queryClient.fetchQuery(
      currentTurnStateQueryOptions(
        "world-1",
        createClient({
          row: {
            calendar_config_json: createCalendarConfig(),
            current_turn_number: 0,
          },
        }),
      ),
    );

    expect(turnState.currentTurnNumber).toBe(1);
    expect(turnState.computedDate).toMatchObject({
      dayOfMonth: 1,
      monthName: "Frostmonth",
      turnNumber: 1,
    });
    expect(turnState.displayLabels.turnLabel).toBe("Turn 1");
  });

  it("returns a normalized error when the calendar config is invalid", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        currentTurnStateQueryOptions(
          "world-1",
          createClient({
            row: {
              calendar_config_json: {
                ...createCalendarConfig(),
                startingWeekdayOffset: 99,
              },
              current_turn_number: 3,
            },
          }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "current_turn_calendar_config_invalid",
      message: "Calendar configuration is invalid.",
      name: "CurrentTurnStateError",
      worldId: "world-1",
    });
  });

  it("returns a normalized error when RLS hides the world", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        currentTurnStateQueryOptions(
          "world-restricted",
          createClient({ row: null }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "current_turn_state_unauthorized",
      message: "Current turn state is unavailable.",
      name: "CurrentTurnStateError",
      worldId: "world-restricted",
    });
  });

  it("returns a normalized error when the calendar config is missing", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        currentTurnStateQueryOptions(
          "world-1",
          createClient({
            row: {
              calendar_config_json: null,
              current_turn_number: 3,
            },
          }),
        ),
      ),
    ).rejects.toSatisfy(isCurrentTurnStateError);
  });

  it("normalizes Supabase error states", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        currentTurnStateQueryOptions(
          "world-1",
          createClient({
            error: {
              code: "42501",
              message: "permission denied for table worlds",
            },
            row: null,
          }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "permission denied for table worlds",
      name: "AuthUiError",
    });
  });

  it("does not retry normalized current turn state errors", () => {
    expect(
      shouldRetryCurrentTurnStateQuery(
        0,
        new CurrentTurnStateError({
          code: "current_turn_calendar_config_invalid",
          message: "Calendar configuration is invalid.",
          worldId: "world-1",
        }),
      ),
    ).toBe(false);
    expect(
      shouldRetryCurrentTurnStateQuery(0, new AuthUiError({ message: "" })),
    ).toBe(true);
    expect(
      shouldRetryCurrentTurnStateQuery(3, new AuthUiError({ message: "" })),
    ).toBe(false);
  });
});

type TestCurrentTurnStateRow = {
  readonly calendar_config_json:
    | WorldCalendarConfig
    | Record<string, unknown>
    | null;
  readonly current_turn_number: number;
};

function createClient({
  error = null,
  row,
}: {
  readonly error?: { readonly code: string; readonly message: string } | null;
  readonly row: TestCurrentTurnStateRow | null;
}): GubernatorSupabaseClient {
  return {
    from: vi.fn(() => createCurrentTurnStateQueryBuilder({ error, row })),
  } as unknown as GubernatorSupabaseClient;
}

function createCurrentTurnStateQueryBuilder({
  error,
  row,
}: {
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly row: TestCurrentTurnStateRow | null;
}): {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
} {
  const builder = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue({ data: row, error });

  return builder;
}

function createCalendarConfig(): WorldCalendarConfig {
  return {
    months: [
      {
        dayCount: 2,
        index: 0,
        name: "Frostmonth",
      },
      {
        dayCount: 3,
        index: 1,
        name: "Rainmonth",
      },
    ],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 1,
    startingYear: 12,
    weekdays: [
      {
        index: 0,
        name: "Moonday",
      },
      {
        index: 1,
        name: "Toilsday",
      },
    ],
    dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
