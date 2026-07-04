import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { eventQueryKeys } from "../queries/eventQueryKeys";

import {
  cancelEventGroupMutationOptions,
  cancelEventMutationOptions,
  createEventGroupMutationOptions,
  deleteEventGroupMutationOptions,
  deleteEventMutationOptions,
  editEventGroupMutationOptions,
  isEventMutationError,
} from "./eventMutations";

import type {
  CreateEventGroupInput,
  EditEventGroupInput,
} from "../schemas/eventSchemas";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";
const GROUP_ID = "22222222-2222-2222-2222-222222222222";
const EVENT_ID = "33333333-3333-3333-3333-333333333333";
const RESOURCE_ID = "44444444-4444-4444-4444-444444444444";
const BUILDING_BLUEPRINT_ID = "55555555-5555-5555-5555-555555555555";

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<T> =
  | { readonly data: T; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError };

function createRpcClient<T>(result: SupabaseResult<T>): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as GubernatorSupabaseClient, rpc };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

function executeMutation<TOptions extends { mutationFn?: unknown }>(
  queryClient: QueryClient,
  options: TOptions,
  variables: unknown,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options as never)
    .execute(variables);
}

const BASE_TARGET = {
  scope_id: null,
  nation_id: null,
  settlement_id: null,
  job_id: null,
  building_blueprint_id: null,
  managed_population_type_id: null,
  amount_value: null,
  multiplier_value: null,
  scope_name: "World",
};

const BASE_EFFECT = {
  effectType: "resource_grant" as const,
  isPercent: false,
  amountValue: 100,
  multiplierValue: null,
  resourceId: RESOURCE_ID,
  jobId: null,
  managedPopulationInstanceId: null,
  managedPopulationTypeId: null,
  managedPopulationMode: null,
  depositInstanceId: null,
  settlementBuildingId: null,
  buildingBlueprintMode: null,
  buildingBlueprintIds: null,
};

function createGroupInput(
  overrides: Partial<CreateEventGroupInput> = {},
): CreateEventGroupInput {
  return {
    worldId: WORLD_ID,
    groupName: "Drought",
    groupDescription: null,
    effects: [BASE_EFFECT],
    scopeType: "world",
    targets: [BASE_TARGET],
    durationType: "instant",
    durationTransitions: null,
    activationTurn: 1,
    createCitizenMemories: false,
    memoryText: null,
    ...overrides,
  };
}

function createEditGroupInput(
  overrides: Partial<EditEventGroupInput> = {},
): EditEventGroupInput {
  return {
    groupId: GROUP_ID,
    worldId: WORLD_ID,
    groupName: "Drought",
    groupDescription: null,
    effects: [BASE_EFFECT],
    durationType: "instant",
    durationTransitions: null,
    activationTurn: 1,
    createCitizenMemories: false,
    memoryText: null,
    ...overrides,
  };
}

describe("createEventGroupMutationOptions", () => {
  it("calls create_event_group_with_events with mapped payload", async () => {
    const { client, rpc } = createRpcClient({
      data: { group_id: GROUP_ID, event_ids: [EVENT_ID] },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = createEventGroupMutationOptions({ client, queryClient });

    const result = await executeMutation(
      queryClient,
      options,
      createGroupInput(),
    );

    expect(result).toEqual({ group_id: GROUP_ID, event_ids: [EVENT_ID] });
    expect(rpc).toHaveBeenCalledWith("create_event_group_with_events", {
      p_world_id: WORLD_ID,
      p_group_name: "Drought",
      p_group_description: null,
      p_effects: [
        {
          effect_type: "resource_grant",
          is_percent: false,
          amount_value: 100,
          multiplier_value: null,
          resource_id: RESOURCE_ID,
          job_id: null,
          managed_population_instance_id: null,
          managed_population_type_id: null,
          deposit_instance_id: null,
          settlement_building_id: null,
          extra_data_jsonb: {},
        },
      ],
      p_scope_type: "world",
      p_targets: [BASE_TARGET],
      p_duration_type: "instant",
      p_duration_transitions: null,
      p_activate_on_transition_after_turn_number: 1,
      p_create_citizen_memories: false,
      p_memory_text: null,
    });
    expect(options.mutationKey).toEqual([
      ...eventQueryKeys.all,
      "create-group",
    ]);
  });

  it("maps managed_population_change mode into extra_data_jsonb", async () => {
    const { client, rpc } = createRpcClient({
      data: { group_id: GROUP_ID, event_ids: [EVENT_ID] },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = createEventGroupMutationOptions({ client, queryClient });

    await executeMutation(
      queryClient,
      options,
      createGroupInput({
        effects: [
          {
            ...BASE_EFFECT,
            effectType: "managed_population_change",
            resourceId: null,
            managedPopulationMode: "type",
          },
        ],
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "create_event_group_with_events",
      expect.objectContaining({
        p_effects: [
          expect.objectContaining({
            effect_type: "managed_population_change",
            extra_data_jsonb: { managed_population_mode: "type" },
          }),
        ],
      }),
    );
  });

  it("maps upkeep_multiplier select-mode blueprint ids into extra_data_jsonb", async () => {
    const { client, rpc } = createRpcClient({
      data: { group_id: GROUP_ID, event_ids: [EVENT_ID] },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = createEventGroupMutationOptions({ client, queryClient });

    await executeMutation(
      queryClient,
      options,
      createGroupInput({
        effects: [
          {
            ...BASE_EFFECT,
            effectType: "upkeep_multiplier",
            resourceId: null,
            multiplierValue: 1.5,
            buildingBlueprintMode: "select",
            buildingBlueprintIds: [BUILDING_BLUEPRINT_ID],
          },
        ],
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "create_event_group_with_events",
      expect.objectContaining({
        p_effects: [
          expect.objectContaining({
            effect_type: "upkeep_multiplier",
            extra_data_jsonb: {
              building_blueprint_mode: "select",
              building_blueprint_ids: [BUILDING_BLUEPRINT_ID],
            },
          }),
        ],
      }),
    );
  });

  it("rejects with event_input_invalid when sustained duration has no transitions", async () => {
    const { client, rpc } = createRpcClient({
      data: { group_id: GROUP_ID, event_ids: [EVENT_ID] },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = createEventGroupMutationOptions({ client, queryClient });

    await expect(
      executeMutation(
        queryClient,
        options,
        createGroupInput({
          durationType: "sustained",
          durationTransitions: null,
        }),
      ),
    ).rejects.toMatchObject({ code: "event_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects with a ZodError before touching the client when input is invalid", async () => {
    const { client, rpc } = createRpcClient({
      data: { group_id: GROUP_ID, event_ids: [EVENT_ID] },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = createEventGroupMutationOptions({ client, queryClient });

    await expect(
      executeMutation(
        queryClient,
        options,
        createGroupInput({ worldId: "not-a-uuid" }),
      ),
    ).rejects.toBeInstanceOf(ZodError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("wraps RPC errors as event_mutation_failed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createEventGroupMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, createGroupInput()),
    ).rejects.toMatchObject({
      code: "event_mutation_failed",
      message: "permission denied",
    });
  });

  it("invalidates the events query cache on success", async () => {
    const { client } = createRpcClient({
      data: { group_id: GROUP_ID, event_ids: [EVENT_ID] },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = createEventGroupMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, createGroupInput());

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: eventQueryKeys.all,
    });
  });
});

describe("cancelEventMutationOptions", () => {
  it("calls cancel_event_or_group with the event id and null group id", async () => {
    const { client, rpc } = createRpcClient({
      data: { cancelled_count: 1 },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = cancelEventMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      eventId: EVENT_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ cancelled_count: 1 });
    expect(rpc).toHaveBeenCalledWith("cancel_event_or_group", {
      p_event_id: EVENT_ID,
      p_group_id: null,
    });
    expect(options.mutationKey).toEqual([
      ...eventQueryKeys.all,
      "cancel-event",
    ]);
  });

  it("wraps RPC errors as event_mutation_failed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { message: "boom" },
    });
    const queryClient = createQueryClient();
    const options = cancelEventMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        eventId: EVENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "event_mutation_failed", message: "boom" });
  });

  it("invalidates the events query cache on success", async () => {
    const { client } = createRpcClient({
      data: { cancelled_count: 1 },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = cancelEventMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      eventId: EVENT_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: eventQueryKeys.all,
    });
  });
});

describe("cancelEventGroupMutationOptions", () => {
  it("calls cancel_event_or_group with the group id and null event id", async () => {
    const { client, rpc } = createRpcClient({
      data: { cancelled_count: 3 },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = cancelEventGroupMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      groupId: GROUP_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ cancelled_count: 3 });
    expect(rpc).toHaveBeenCalledWith("cancel_event_or_group", {
      p_event_id: null,
      p_group_id: GROUP_ID,
    });
    expect(options.mutationKey).toEqual([
      ...eventQueryKeys.all,
      "cancel-group",
    ]);
  });

  it("wraps RPC errors as event_mutation_failed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { message: "boom" },
    });
    const queryClient = createQueryClient();
    const options = cancelEventGroupMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        groupId: GROUP_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "event_mutation_failed", message: "boom" });
  });

  it("invalidates the events query cache on success", async () => {
    const { client } = createRpcClient({
      data: { cancelled_count: 3 },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = cancelEventGroupMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      groupId: GROUP_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: eventQueryKeys.all,
    });
  });
});

describe("editEventGroupMutationOptions", () => {
  it("calls update_event_group_with_events with mapped payload", async () => {
    const { client, rpc } = createRpcClient({
      data: { group_id: GROUP_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = editEventGroupMutationOptions({ client, queryClient });

    const result = await executeMutation(
      queryClient,
      options,
      createEditGroupInput(),
    );

    expect(result).toEqual({ group_id: GROUP_ID });
    expect(rpc).toHaveBeenCalledWith("update_event_group_with_events", {
      p_group_id: GROUP_ID,
      p_group_name: "Drought",
      p_group_description: null,
      p_effects: [
        {
          effect_type: "resource_grant",
          is_percent: false,
          amount_value: 100,
          multiplier_value: null,
          resource_id: RESOURCE_ID,
          job_id: null,
          managed_population_instance_id: null,
          managed_population_type_id: null,
          deposit_instance_id: null,
          settlement_building_id: null,
          extra_data_jsonb: {},
        },
      ],
      p_duration_type: "instant",
      p_duration_transitions: null,
      p_activate_on_transition_after_turn_number: 1,
      p_create_citizen_memories: false,
      p_memory_text: null,
    });
    expect(options.mutationKey).toEqual([...eventQueryKeys.all, "edit-group"]);
  });

  it("rejects with event_input_invalid when sustained duration has no transitions", async () => {
    const { client, rpc } = createRpcClient({
      data: { group_id: GROUP_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = editEventGroupMutationOptions({ client, queryClient });

    await expect(
      executeMutation(
        queryClient,
        options,
        createEditGroupInput({
          durationType: "sustained",
          durationTransitions: null,
        }),
      ),
    ).rejects.toMatchObject({ code: "event_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("wraps RPC errors as event_mutation_failed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { message: "boom" },
    });
    const queryClient = createQueryClient();
    const options = editEventGroupMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, createEditGroupInput()),
    ).rejects.toMatchObject({ code: "event_mutation_failed", message: "boom" });
  });

  it("invalidates the events query cache on success", async () => {
    const { client } = createRpcClient({
      data: { group_id: GROUP_ID },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = editEventGroupMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, createEditGroupInput());

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: eventQueryKeys.all,
    });
  });
});

describe("deleteEventMutationOptions", () => {
  it("calls delete_event_or_group with the event id and null group id", async () => {
    const { client, rpc } = createRpcClient({
      data: { deleted_count: 1 },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteEventMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      eventId: EVENT_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ deleted_count: 1 });
    expect(rpc).toHaveBeenCalledWith("delete_event_or_group", {
      p_event_id: EVENT_ID,
      p_group_id: null,
    });
    expect(options.mutationKey).toEqual([
      ...eventQueryKeys.all,
      "delete-event",
    ]);
  });

  it("wraps RPC errors as event_mutation_failed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { message: "boom" },
    });
    const queryClient = createQueryClient();
    const options = deleteEventMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        eventId: EVENT_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "event_mutation_failed", message: "boom" });
  });

  it("invalidates the events query cache on success", async () => {
    const { client } = createRpcClient({
      data: { deleted_count: 1 },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = deleteEventMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      eventId: EVENT_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: eventQueryKeys.all,
    });
  });
});

describe("deleteEventGroupMutationOptions", () => {
  it("calls delete_event_or_group with the group id and null event id", async () => {
    const { client, rpc } = createRpcClient({
      data: { deleted_count: 4 },
      error: null,
    });
    const queryClient = createQueryClient();
    const options = deleteEventGroupMutationOptions({ client, queryClient });

    const result = await executeMutation(queryClient, options, {
      groupId: GROUP_ID,
      worldId: WORLD_ID,
    });

    expect(result).toEqual({ deleted_count: 4 });
    expect(rpc).toHaveBeenCalledWith("delete_event_or_group", {
      p_event_id: null,
      p_group_id: GROUP_ID,
    });
    expect(options.mutationKey).toEqual([
      ...eventQueryKeys.all,
      "delete-group",
    ]);
  });

  it("wraps RPC errors as event_mutation_failed", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { message: "boom" },
    });
    const queryClient = createQueryClient();
    const options = deleteEventGroupMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        groupId: GROUP_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "event_mutation_failed", message: "boom" });
  });

  it("invalidates the events query cache on success", async () => {
    const { client } = createRpcClient({
      data: { deleted_count: 4 },
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const options = deleteEventGroupMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      groupId: GROUP_ID,
      worldId: WORLD_ID,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: eventQueryKeys.all,
    });
  });
});

describe("isEventMutationError", () => {
  it("identifies EventMutationError instances correctly", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { message: "boom" },
    });
    const queryClient = createQueryClient();
    const options = createEventGroupMutationOptions({ client, queryClient });

    const err = await executeMutation(
      queryClient,
      options,
      createGroupInput(),
    ).catch((e: unknown) => e);

    expect(isEventMutationError(err)).toBe(true);
    expect(isEventMutationError(new Error("other"))).toBe(false);
  });
});
