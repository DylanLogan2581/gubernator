import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { z } from "zod";

import { normalizeSupabaseError } from "@/features/auth";
import { type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { type CitizenMemory } from "../queries/citizenMemoriesQueries";
import { citizensQueryKeys } from "../queries/citizensQueryKeys";

// ---- error types --------------------------------------------------------

const CitizenMemoryMutationErrorCode = z.enum([
  "memory_not_found",
  "validation_error",
]);
type CitizenMemoryMutationErrorCode = z.infer<
  typeof CitizenMemoryMutationErrorCode
>;

export class CitizenMemoryMutationError extends Error {
  readonly code: CitizenMemoryMutationErrorCode;
  readonly issues: readonly MutationIssue[];
  constructor({
    code,
    message,
    issues = [],
  }: {
    code: CitizenMemoryMutationErrorCode;
    message: string;
    issues?: readonly MutationIssue[];
  }) {
    super(message);
    this.code = code;
    this.issues = issues;
    this.name = "CitizenMemoryMutationError";
  }
}

export function isCitizenMemoryMutationError(
  error: unknown,
): error is CitizenMemoryMutationError {
  return error instanceof CitizenMemoryMutationError;
}

// ---- schemas ------------------------------------------------------------

const createCitizenMemoryInputSchema = z.object({
  citizenId: z.string().min(1),
  memoryText: z
    .string()
    .min(1, "Memory text is required.")
    .max(2000, "Memory text is too long."),
  occurredOnTurnNumber: z
    .number()
    .int()
    .positive("Turn number must be positive."),
  worldId: z.string().min(1),
});

const updateCitizenMemoryInputSchema = z.object({
  citizenId: z.string().min(1),
  id: z.string().min(1),
  memoryText: z
    .string()
    .min(1, "Memory text is required.")
    .max(2000, "Memory text is too long."),
  occurredOnTurnNumber: z
    .number()
    .int()
    .positive("Turn number must be positive."),
  worldId: z.string().min(1),
});

const deleteCitizenMemoryInputSchema = z.object({
  citizenId: z.string().min(1),
  id: z.string().min(1),
  worldId: z.string().min(1),
});

type CreateCitizenMemoryInput = z.input<typeof createCitizenMemoryInputSchema>;
type UpdateCitizenMemoryInput = z.input<typeof updateCitizenMemoryInputSchema>;
type DeleteCitizenMemoryInput = z.input<typeof deleteCitizenMemoryInputSchema>;

type CreateCitizenMemoryMutationOptions = UseMutationOptions<
  CitizenMemory,
  Error,
  CreateCitizenMemoryInput
>;
type UpdateCitizenMemoryMutationOptions = UseMutationOptions<
  CitizenMemory,
  Error,
  UpdateCitizenMemoryInput
>;
type DeleteCitizenMemoryMutationOptions = UseMutationOptions<
  void,
  Error,
  DeleteCitizenMemoryInput
>;

function toMutationError(
  issues: readonly MutationIssue[],
): CitizenMemoryMutationError {
  return new CitizenMemoryMutationError({
    code: "validation_error",
    issues,
    message: "Invalid memory input.",
  });
}

// ---- data functions -----------------------------------------------------

async function createCitizenMemory(
  client: GubernatorSupabaseClient,
  input: CreateCitizenMemoryInput,
): Promise<CitizenMemory> {
  const values = parseMutationInput(
    createCitizenMemoryInputSchema,
    input,
    toMutationError,
  );

  const { data, error } = await client
    .from("citizen_memories")
    .insert({
      citizen_id: values.citizenId,
      memory_text: values.memoryText,
      occurred_on_turn_number: values.occurredOnTurnNumber,
      source: "manual",
      world_id: values.worldId,
    })
    .select(
      "id, citizen_id, world_id, memory_text, occurred_on_turn_number, source, event_id, created_at",
    )
    .single();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    citizenId: data.citizen_id,
    createdAt: data.created_at,
    eventId: data.event_id,
    id: data.id,
    memoryText: data.memory_text,
    occurredOnTurnNumber: data.occurred_on_turn_number,
    source: data.source,
    worldId: data.world_id,
  };
}

async function updateCitizenMemory(
  client: GubernatorSupabaseClient,
  input: UpdateCitizenMemoryInput,
): Promise<CitizenMemory> {
  const values = parseMutationInput(
    updateCitizenMemoryInputSchema,
    input,
    toMutationError,
  );

  const { data, error } = await client
    .from("citizen_memories")
    .update({
      memory_text: values.memoryText,
      occurred_on_turn_number: values.occurredOnTurnNumber,
    })
    .eq("id", values.id)
    .eq("citizen_id", values.citizenId)
    .eq("world_id", values.worldId)
    .select(
      "id, citizen_id, world_id, memory_text, occurred_on_turn_number, source, event_id, created_at",
    )
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new CitizenMemoryMutationError({
      code: "memory_not_found",
      message: "Memory could not be updated.",
    });
  }

  return {
    citizenId: data.citizen_id,
    createdAt: data.created_at,
    eventId: data.event_id,
    id: data.id,
    memoryText: data.memory_text,
    occurredOnTurnNumber: data.occurred_on_turn_number,
    source: data.source,
    worldId: data.world_id,
  };
}

async function deleteCitizenMemory(
  client: GubernatorSupabaseClient,
  input: DeleteCitizenMemoryInput,
): Promise<void> {
  const values = parseMutationInput(
    deleteCitizenMemoryInputSchema,
    input,
    toMutationError,
  );

  const { error } = await client
    .from("citizen_memories")
    .delete()
    .eq("id", values.id)
    .eq("citizen_id", values.citizenId)
    .eq("world_id", values.worldId);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

// ---- mutation options ---------------------------------------------------

function invalidateMemories(
  queryClient: QueryClient,
  citizenId: string,
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: citizensQueryKeys.memories(citizenId),
  });
}

export function createCitizenMemoryMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateCitizenMemoryMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateCitizenMemoryInput) =>
      createCitizenMemory(client, input),
    mutationKey: [...citizensQueryKeys.all, "create-citizen-memory"],
    onSuccess: (memory) => invalidateMemories(queryClient, memory.citizenId),
  });
}

export function updateCitizenMemoryMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateCitizenMemoryMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateCitizenMemoryInput) =>
      updateCitizenMemory(client, input),
    mutationKey: [...citizensQueryKeys.all, "update-citizen-memory"],
    onSuccess: (memory) => invalidateMemories(queryClient, memory.citizenId),
  });
}

export function deleteCitizenMemoryMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteCitizenMemoryMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteCitizenMemoryInput) =>
      deleteCitizenMemory(client, input),
    mutationKey: [...citizensQueryKeys.all, "delete-citizen-memory"],
    onSuccess: (_result, input) =>
      invalidateMemories(queryClient, input.citizenId),
  });
}
