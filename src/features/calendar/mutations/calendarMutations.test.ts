import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import { createAccessContext } from "@/features/permissions";
import type { WorldPermissionContext } from "@/features/worlds";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  isSaveWorldCalendarConfigError,
  saveWorldCalendarConfigMutationOptions,
} from "./calendarMutations";

import type { WorldCalendarConfig } from "../schemas/calendarConfigSchemas";

describe("saveWorldCalendarConfigMutationOptions", () => {
  it("validates, saves only calendar_config_json, and invalidates date consumers", async () => {
    const config = createCalendarConfig();
    const clientFixture = createClient();
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = saveWorldCalendarConfigMutationOptions({
      accessContext: createAdminAccessContext(),
      client: clientFixture.client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      config,
      worldId: "world-1",
    });

    expect(result).toEqual(config);
    expect(options.mutationKey).toEqual([
      "calendar",
      "save-world-calendar-config",
    ]);
    expect(clientFixture.from).toHaveBeenCalledWith("worlds");
    expect(clientFixture.select).toHaveBeenCalledWith(
      "archived_at,id,owner_id,status,visibility",
    );
    expect(clientFixture.readEq).toHaveBeenCalledWith("id", "world-1");
    expect(clientFixture.update).toHaveBeenCalledWith({
      calendar_config_json: config,
    });
    expect(clientFixture.update).toHaveBeenCalledOnce();
    expect(clientFixture.updateEqId).toHaveBeenCalledWith("id", "world-1");
    expect(clientFixture.updateEqStatus).toHaveBeenCalledWith(
      "status",
      "active",
    );
    expect(clientFixture.updateSelect).toHaveBeenCalledWith("id");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["calendar"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["worlds"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["turns", "current-turn-state", "world-1"],
    });
  });

  it("rejects invalid config before reading or writing", async () => {
    const clientFixture = createClient();
    const queryClient = createQueryClient();
    const options = saveWorldCalendarConfigMutationOptions({
      accessContext: createAdminAccessContext(),
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: {
          ...createCalendarConfig(),
          startingWeekdayOffset: 99,
        },
        worldId: "world-1",
      }),
    ).rejects.toMatchObject({
      code: "world_calendar_config_invalid",
      message: "Calendar configuration is invalid.",
      name: "SaveWorldCalendarConfigError",
      worldId: "world-1",
    });
    expect(clientFixture.from).not.toHaveBeenCalled();
  });

  it("returns an unauthorized error when access context cannot admin the world", async () => {
    const clientFixture = createClient({
      readResult: {
        data: createWorldRow({
          owner_id: "user-2",
          visibility: "public",
        }),
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = saveWorldCalendarConfigMutationOptions({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [],
      }),
      client: clientFixture.client,
      queryClient,
    });

    const mutationPromise = executeMutation(queryClient, options, {
      config: createCalendarConfig(),
      worldId: "world-1",
    });

    await expect(mutationPromise).rejects.toSatisfy(
      isSaveWorldCalendarConfigError,
    );
    await expect(mutationPromise).rejects.toMatchObject({
      code: "world_calendar_config_unauthorized",
      message: "You do not have permission to update this calendar.",
      worldId: "world-1",
    });
    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("returns an unauthorized error when RLS hides the world", async () => {
    const clientFixture = createClient({
      readResult: { data: null, error: null },
    });
    const queryClient = createQueryClient();
    const options = saveWorldCalendarConfigMutationOptions({
      accessContext: createAdminAccessContext(),
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: createCalendarConfig(),
        worldId: "world-1",
      }),
    ).rejects.toMatchObject({
      code: "world_calendar_config_unauthorized",
      message: "You do not have permission to update this calendar.",
      worldId: "world-1",
    });
    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("returns an archived-world error before writing", async () => {
    const clientFixture = createClient({
      readResult: {
        data: createWorldRow({
          archived_at: "2026-01-03T00:00:00.000Z",
          status: "archived",
        }),
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = saveWorldCalendarConfigMutationOptions({
      accessContext: createAdminAccessContext(),
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: createCalendarConfig(),
        worldId: "world-1",
      }),
    ).rejects.toMatchObject({
      code: "world_calendar_config_archived",
      message: "Archived worlds are read-only.",
      name: "SaveWorldCalendarConfigError",
      worldId: "world-1",
    });
    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("normalizes Supabase write errors", async () => {
    const queryClient = createQueryClient();
    const options = saveWorldCalendarConfigMutationOptions({
      accessContext: createAdminAccessContext(),
      client: createClient({
        updateResult: {
          data: null,
          error: {
            code: "42501",
            message: "permission denied for table worlds",
          },
        },
      }).client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: createCalendarConfig(),
        worldId: "world-1",
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

type SaveWorldCalendarConfigOptions = ReturnType<
  typeof saveWorldCalendarConfigMutationOptions
>;
type SupabaseError = {
  readonly code?: string;
  readonly message: string;
};
type SupabaseResult<TData> =
  | {
      readonly data: TData;
      readonly error: null;
    }
  | {
      readonly data: null;
      readonly error: SupabaseError | null;
    };
type WorldCalendarSaveAccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly owner_id: string;
  readonly status: string;
  readonly visibility: string;
};

function createClient({
  readResult = {
    data: createWorldRow(),
    error: null,
  },
  updateResult = {
    data: { id: "world-1" },
    error: null,
  },
}: {
  readonly readResult?: SupabaseResult<WorldCalendarSaveAccessRow>;
  readonly updateResult?: SupabaseResult<{ readonly id: string }>;
} = {}): {
  readonly client: GubernatorSupabaseClient;
  readonly from: ReturnType<typeof vi.fn>;
  readonly readEq: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly updateEqId: ReturnType<typeof vi.fn>;
  readonly updateEqStatus: ReturnType<typeof vi.fn>;
  readonly updateSelect: ReturnType<typeof vi.fn>;
} {
  const readMaybeSingle = vi.fn().mockResolvedValue(readResult);
  const readEq = vi.fn(() => ({ maybeSingle: readMaybeSingle }));
  const select = vi.fn(() => ({ eq: readEq }));
  const updateMaybeSingle = vi.fn().mockResolvedValue(updateResult);
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEqStatus = vi.fn(() => ({ select: updateSelect }));
  const updateEqId = vi.fn(() => ({ eq: updateEqStatus }));
  const update = vi.fn(() => ({ eq: updateEqId }));
  const from = vi.fn(() => ({ select, update }));

  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    from,
    readEq,
    select,
    update,
    updateEqId,
    updateEqStatus,
    updateSelect,
  };
}

function createWorldRow(
  overrides: Partial<WorldCalendarSaveAccessRow> = {},
): WorldCalendarSaveAccessRow {
  return {
    archived_at: null,
    id: "world-1",
    owner_id: "user-1",
    status: "active",
    visibility: "private",
    ...overrides,
  };
}

function createAdminAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: "user-1",
    worldAdminWorldIds: [],
  });
}

function createCalendarConfig(): WorldCalendarConfig {
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
    dateFormatTemplate: "{weekday}, {month} {day}, Year {year}",
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeMutation(
  queryClient: QueryClient,
  options: SaveWorldCalendarConfigOptions,
  variables: Parameters<
    NonNullable<SaveWorldCalendarConfigOptions["mutationFn"]>
  >[0],
): Promise<WorldCalendarConfig> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}
