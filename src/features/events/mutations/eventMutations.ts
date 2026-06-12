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

import { eventQueryKeys } from "../queries/eventQueryKeys";
import {
  cancelEventInputSchema,
  cancelEventGroupInputSchema,
  createEventGroupInputSchema,
  type CancelEventInput,
  type CancelEventGroupInput,
  type CreateEventGroupInput,
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
          message: "Duration transitions required for sustained events",
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const { data, error } = await (client.rpc as any)(
        "create_event_group_with_events",
        {
          p_world_id: values.worldId,
          p_group_name: values.groupName,
          p_group_description: values.groupDescription ?? null,
          p_effect_type: values.effectType,
          p_scope_type: values.scopeType,
          p_targets: values.targets,
          p_duration_type: values.durationType,
          p_duration_transitions:
            values.durationType === "sustained"
              ? values.durationTransitions
              : null,
          p_activate_on_transition_after_turn_number: values.activationTurn,
          p_create_citizen_memories: values.createCitizenMemories,
          p_memory_text: values.memoryText ?? null,
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const { data, error } = await (client.rpc as any)(
        "cancel_event_or_group",
        {
          p_event_id: values.eventId,
          p_group_id: null,
        },
      );

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const { data, error } = await (client.rpc as any)(
        "cancel_event_or_group",
        {
          p_event_id: null,
          p_group_id: values.groupId,
        },
      );

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
