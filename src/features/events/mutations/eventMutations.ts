import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError } from "@/lib/mutationError";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Json } from "@/types/database";

import { eventQueryKeys } from "../queries/eventQueryKeys";
import {
  cancelEventInputSchema,
  cancelEventGroupInputSchema,
  createEventGroupInputSchema,
  editEventGroupInputSchema,
  deleteEventInputSchema,
  deleteEventGroupInputSchema,
  type CancelEventInput,
  type CancelEventGroupInput,
  type CreateEventGroupInput,
  type EditEventGroupInput,
  type DeleteEventInput,
  type DeleteEventGroupInput,
} from "../schemas/eventSchemas";

type EventMutationErrorCode =
  | "event_input_invalid"
  | "event_not_authorized"
  | "event_not_found"
  | "event_mutation_failed";

export const { ErrorClass: EventMutationError, isError: isEventMutationError } =
  createMutationError<EventMutationErrorCode>("EventMutationError");
export type EventMutationError = InstanceType<typeof EventMutationError>;

type CreateEventGroupResult = {
  readonly group_id: string;
  readonly event_ids: string[];
};

type CancelEventResult = {
  readonly cancelled_count: number;
};

type DeleteEventResult = {
  readonly deleted_count: number;
};

type MutationFactoryOpts = {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
};

/**
 * Mutation for creating an event group with multiple events atomically.
 */
export function createEventGroupMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  CreateEventGroupResult,
  Error,
  CreateEventGroupInput
> {
  return mutationOptions<CreateEventGroupResult, Error, CreateEventGroupInput>({
    mutationFn: async (input: CreateEventGroupInput) => {
      const values = createEventGroupInputSchema.parse(input);

      // Validate that sustained events have duration_transitions
      if (
        values.durationType === "sustained" &&
        (values.durationTransitions === null ||
          values.durationTransitions === undefined ||
          values.durationTransitions <= 0)
      ) {
        throw new EventMutationError({
          code: "event_input_invalid",
          message: "Duration in turns is required for sustained events",
        });
      }

      const { data, error } = await client.rpc(
        "create_event_group_with_events",
        {
          p_world_id: values.worldId,
          p_group_name: values.groupName,
          // Generated types don't reflect nullable parameters; null is valid.
          p_group_description: (values.groupDescription ?? null) as string,
          p_effects: values.effects.map((e) => {
            const extraData: Record<string, unknown> = {};

            if (
              e.effectType === "managed_population_change" &&
              typeof e.managedPopulationMode === "string"
            ) {
              extraData.managed_population_mode = e.managedPopulationMode;
            }

            if (
              e.effectType === "upkeep_multiplier" &&
              typeof e.buildingBlueprintMode === "string"
            ) {
              extraData.building_blueprint_mode = e.buildingBlueprintMode;
              if (
                e.buildingBlueprintMode === "select" &&
                Array.isArray(e.buildingBlueprintIds)
              ) {
                extraData.building_blueprint_ids = e.buildingBlueprintIds;
              }
              if (
                e.buildingBlueprintMode === "instance" &&
                Array.isArray(e.buildingInstanceIds)
              ) {
                extraData.building_instance_ids = e.buildingInstanceIds;
              }
            }

            if (
              e.effectType === "deposit_destroyed" &&
              e.depositDestroyedMode === "type" &&
              typeof e.depositTypeId === "string"
            ) {
              extraData.deposit_destroyed_mode = e.depositDestroyedMode;
              extraData.deposit_type_id = e.depositTypeId;
            }

            return {
              effect_type: e.effectType,
              is_percent: e.isPercent,
              amount_value: e.amountValue,
              multiplier_value: e.multiplierValue,
              resource_id: e.resourceId,
              job_id: e.jobId,
              managed_population_instance_id: e.managedPopulationInstanceId,

              managed_population_type_id: e.managedPopulationTypeId,
              deposit_instance_id: e.depositInstanceId,
              settlement_building_id: e.settlementBuildingId,
              extra_data_jsonb: extraData as Json,
            };
          }),
          p_scope_type: values.scopeType,
          p_targets: values.targets,
          p_duration_type: values.durationType,
          // Generated types don't reflect nullable parameters; null is valid.
          p_duration_transitions: (values.durationType === "sustained"
            ? values.durationTransitions
            : null) as number,
          p_activate_on_transition_after_turn_number: values.activationTurn,
          p_create_citizen_memories: false,
          p_memory_text: null as unknown as string,
          p_memories: values.memories.map((m) => ({
            memory_text: m.memoryText,
            turn_offset: m.turnOffset,
          })),
        },
      );

      if (error !== null) {
        const normalized = normalizeSupabaseError(error);
        throw new EventMutationError({
          code: "event_mutation_failed",
          message: normalized.message,
        });
      }

      return data as CreateEventGroupResult;
    },
    mutationKey: [...eventQueryKeys.all, "create-group"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: eventQueryKeys.all,
      });
    },
  });
}

/**
 * Mutation for canceling a single event.
 */
export function cancelEventMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  CancelEventResult,
  Error,
  CancelEventInput
> {
  return mutationOptions<CancelEventResult, Error, CancelEventInput>({
    mutationFn: async (input: CancelEventInput) => {
      const values = cancelEventInputSchema.parse(input);

      const { data, error } = await client.rpc("cancel_event_or_group", {
        p_event_id: values.eventId,
        // Generated types don't reflect nullable parameters; null is valid.
        p_group_id: null as unknown as string,
      });

      if (error !== null) {
        const normalized = normalizeSupabaseError(error);
        throw new EventMutationError({
          code: "event_mutation_failed",
          message: normalized.message,
        });
      }

      return data as CancelEventResult;
    },
    mutationKey: [...eventQueryKeys.all, "cancel-event"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: eventQueryKeys.all,
      });
    },
  });
}

/**
 * Mutation for canceling an entire event group.
 */
export function cancelEventGroupMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  CancelEventResult,
  Error,
  CancelEventGroupInput
> {
  return mutationOptions<CancelEventResult, Error, CancelEventGroupInput>({
    mutationFn: async (input: CancelEventGroupInput) => {
      const values = cancelEventGroupInputSchema.parse(input);

      const { data, error } = await client.rpc("cancel_event_or_group", {
        // Generated types don't reflect nullable parameters; null is valid.
        p_event_id: null as unknown as string,
        p_group_id: values.groupId,
      });

      if (error !== null) {
        const normalized = normalizeSupabaseError(error);
        throw new EventMutationError({
          code: "event_mutation_failed",
          message: normalized.message,
        });
      }

      return data as CancelEventResult;
    },
    mutationKey: [...eventQueryKeys.all, "cancel-group"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: eventQueryKeys.all,
      });
    },
  });
}

type EditEventGroupResult = {
  readonly group_id: string;
};

/**
 * Mutation for editing an event group (name, description, effects, duration, activation turn, memory).
 * Scope and targets are locked (cannot be changed).
 */
export function editEventGroupMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  EditEventGroupResult,
  Error,
  EditEventGroupInput
> {
  return mutationOptions<EditEventGroupResult, Error, EditEventGroupInput>({
    mutationFn: async (input: EditEventGroupInput) => {
      const values = editEventGroupInputSchema.parse(input);

      // Validate that sustained events have duration_transitions
      if (
        values.durationType === "sustained" &&
        (values.durationTransitions === null ||
          values.durationTransitions === undefined ||
          values.durationTransitions <= 0)
      ) {
        throw new EventMutationError({
          code: "event_input_invalid",
          message: "Duration in turns is required for sustained events",
        });
      }

      const { data, error } = await client.rpc(
        "update_event_group_with_events",
        {
          p_group_id: values.groupId,
          p_group_name: values.groupName,
          // Generated types don't reflect nullable parameters; null is valid.
          p_group_description: (values.groupDescription ?? null) as string,
          p_effects: values.effects.map((e) => {
            const extraData: Record<string, unknown> = {};

            if (
              e.effectType === "managed_population_change" &&
              typeof e.managedPopulationMode === "string"
            ) {
              extraData.managed_population_mode = e.managedPopulationMode;
            }

            if (
              e.effectType === "upkeep_multiplier" &&
              typeof e.buildingBlueprintMode === "string"
            ) {
              extraData.building_blueprint_mode = e.buildingBlueprintMode;
              if (
                e.buildingBlueprintMode === "select" &&
                Array.isArray(e.buildingBlueprintIds)
              ) {
                extraData.building_blueprint_ids = e.buildingBlueprintIds;
              }
              if (
                e.buildingBlueprintMode === "instance" &&
                Array.isArray(e.buildingInstanceIds)
              ) {
                extraData.building_instance_ids = e.buildingInstanceIds;
              }
            }

            if (
              e.effectType === "deposit_destroyed" &&
              e.depositDestroyedMode === "type" &&
              typeof e.depositTypeId === "string"
            ) {
              extraData.deposit_destroyed_mode = e.depositDestroyedMode;
              extraData.deposit_type_id = e.depositTypeId;
            }

            return {
              effect_type: e.effectType,
              is_percent: e.isPercent,
              amount_value: e.amountValue,
              multiplier_value: e.multiplierValue,
              resource_id: e.resourceId,
              job_id: e.jobId,
              managed_population_instance_id: e.managedPopulationInstanceId,
              managed_population_type_id: e.managedPopulationTypeId,
              deposit_instance_id: e.depositInstanceId,
              settlement_building_id: e.settlementBuildingId,
              extra_data_jsonb: extraData as Json,
            };
          }),
          p_duration_type: values.durationType,
          // Generated types don't reflect nullable parameters; null is valid.
          p_duration_transitions: (values.durationType === "sustained"
            ? values.durationTransitions
            : null) as number,
          p_activate_on_transition_after_turn_number: values.activationTurn,
          p_create_citizen_memories: false,
          p_memory_text: null as unknown as string,
          p_memories: values.memories.map((m) => ({
            memory_text: m.memoryText,
            turn_offset: m.turnOffset,
          })),
        },
      );

      if (error !== null) {
        const normalized = normalizeSupabaseError(error);
        throw new EventMutationError({
          code: "event_mutation_failed",
          message: normalized.message,
        });
      }

      return data as EditEventGroupResult;
    },
    mutationKey: [...eventQueryKeys.all, "edit-group"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: eventQueryKeys.all,
      });
    },
  });
}

/**
 * Mutation for deleting a single event.
 * Only cancelled events may be deleted.
 */
export function deleteEventMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  DeleteEventResult,
  Error,
  DeleteEventInput
> {
  return mutationOptions<DeleteEventResult, Error, DeleteEventInput>({
    mutationFn: async (input: DeleteEventInput) => {
      const values = deleteEventInputSchema.parse(input);

      const { data, error } = await client.rpc("delete_event_or_group", {
        p_event_id: values.eventId,
        // Generated types don't reflect nullable parameters; null is valid.
        p_group_id: null as unknown as string,
      });

      if (error !== null) {
        const normalized = normalizeSupabaseError(error);
        throw new EventMutationError({
          code: "event_mutation_failed",
          message: normalized.message,
        });
      }

      return data as DeleteEventResult;
    },
    mutationKey: [...eventQueryKeys.all, "delete-event"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: eventQueryKeys.all,
      });
    },
  });
}

/**
 * Mutation for deleting an entire event group.
 * Only event groups with all cancelled events may be deleted.
 */
export function deleteEventGroupMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: MutationFactoryOpts): UseMutationOptions<
  DeleteEventResult,
  Error,
  DeleteEventGroupInput
> {
  return mutationOptions<DeleteEventResult, Error, DeleteEventGroupInput>({
    mutationFn: async (input: DeleteEventGroupInput) => {
      const values = deleteEventGroupInputSchema.parse(input);

      const { data, error } = await client.rpc("delete_event_or_group", {
        // Generated types don't reflect nullable parameters; null is valid.
        p_event_id: null as unknown as string,
        p_group_id: values.groupId,
      });

      if (error !== null) {
        const normalized = normalizeSupabaseError(error);
        throw new EventMutationError({
          code: "event_mutation_failed",
          message: normalized.message,
        });
      }

      return data as DeleteEventResult;
    },
    mutationKey: [...eventQueryKeys.all, "delete-group"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: eventQueryKeys.all,
      });
    },
  });
}
