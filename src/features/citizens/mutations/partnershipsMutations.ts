import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { citizensQueryKeys } from "../queries/citizensQueryKeys";
import {
  toPartnership,
  type PartnershipRow,
} from "../queries/partnershipsQueries";
import {
  createPartnershipInputSchema,
  dissolvePartnershipInputSchema,
  markPartnershipWidowedInputSchema,
  reassignPartnerInputSchema,
  type CreatePartnershipInput,
  type DissolvePartnershipInput,
  type MarkPartnershipWidowedInput,
  type ReassignPartnerInput,
} from "../schemas/partnershipSchemas";

import type { Partnership } from "../types/partnershipTypes";
import type { z } from "zod";

type PartnershipMutationErrorCode =
  | "partnership_input_invalid"
  | "partnership_unauthorized";

type CreatePartnershipMutationOptions = UseMutationOptions<
  Partnership,
  AuthUiError | PartnershipMutationError,
  CreatePartnershipInput
>;
type DissolvePartnershipMutationOptions = UseMutationOptions<
  Partnership,
  AuthUiError | PartnershipMutationError,
  DissolvePartnershipInput
>;
type MarkPartnershipWidowedMutationOptions = UseMutationOptions<
  Partnership,
  AuthUiError | PartnershipMutationError,
  MarkPartnershipWidowedInput
>;
type ReassignPartnerMutationOptions = UseMutationOptions<
  Partnership,
  AuthUiError | PartnershipMutationError,
  ReassignPartnerInput
>;

export type PartnershipMutationIssue = MutationIssue;

export const {
  ErrorClass: PartnershipMutationError,
  isError: isPartnershipMutationError,
} = createMutationError<PartnershipMutationErrorCode>(
  "PartnershipMutationError",
);
export type PartnershipMutationError = InstanceType<
  typeof PartnershipMutationError
>;

export function createPartnershipMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreatePartnershipMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreatePartnershipInput) =>
      createPartnership(client, input),
    mutationKey: [...citizensQueryKeys.all, "create-partnership"],
    onSuccess: (partnership) =>
      invalidatePartnershipCaches(queryClient, partnership),
  });
}

export function dissolvePartnershipMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DissolvePartnershipMutationOptions {
  return mutationOptions({
    mutationFn: (input: DissolvePartnershipInput) =>
      dissolvePartnership(client, input),
    mutationKey: [...citizensQueryKeys.all, "dissolve-partnership"],
    onSuccess: (partnership) =>
      invalidatePartnershipCaches(queryClient, partnership),
  });
}

export function markPartnershipWidowedMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): MarkPartnershipWidowedMutationOptions {
  return mutationOptions({
    mutationFn: (input: MarkPartnershipWidowedInput) =>
      markPartnershipWidowed(client, input),
    mutationKey: [...citizensQueryKeys.all, "mark-partnership-widowed"],
    onSuccess: (partnership) =>
      invalidatePartnershipCaches(queryClient, partnership),
  });
}

export function reassignPartnerMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ReassignPartnerMutationOptions {
  return mutationOptions({
    mutationFn: (input: ReassignPartnerInput) => reassignPartner(client, input),
    mutationKey: [...citizensQueryKeys.all, "reassign-partner"],
    onSuccess: (partnership) =>
      invalidatePartnershipCaches(queryClient, partnership),
  });
}

async function invalidatePartnershipCaches(
  queryClient: QueryClient,
  partnership: Partnership,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: citizensQueryKeys.partnershipsForCitizen(
        partnership.citizenAId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: citizensQueryKeys.partnershipsForCitizen(
        partnership.citizenBId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: citizensQueryKeys.activePartnershipForCitizen(
        partnership.citizenAId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: citizensQueryKeys.activePartnershipForCitizen(
        partnership.citizenBId,
      ),
    }),
  ]);
}

async function createPartnership(
  client: GubernatorSupabaseClient,
  input: CreatePartnershipInput,
): Promise<Partnership> {
  const values = parseInput(createPartnershipInputSchema, input);

  const { data, error } = await client
    .rpc("create_partnership", {
      p_change_reason: values.changeReason,
      p_citizen_a_id: values.citizenAId,
      p_citizen_b_id: values.citizenBId,
      p_ended_on_turn_number: values.endedOnTurnNumber ?? undefined,
      p_formed_on_turn_number: values.formedOnTurnNumber,
      p_status: values.status ?? "active",
      p_turn_transition_id: values.turnTransitionId,
    })
    .maybeSingle<PartnershipRow>();

  return assertPartnershipRow(data, error, "Partnership could not be created.");
}

async function dissolvePartnership(
  client: GubernatorSupabaseClient,
  input: DissolvePartnershipInput,
): Promise<Partnership> {
  const values = parseInput(dissolvePartnershipInputSchema, input);

  const { data, error } = await client
    .rpc("dissolve_partnership", {
      p_change_reason: values.changeReason,
      p_ended_on_turn_number: values.endedOnTurnNumber,
      p_partnership_id: values.partnershipId,
      p_turn_transition_id: values.turnTransitionId,
    })
    .maybeSingle<PartnershipRow>();

  return assertPartnershipRow(
    data,
    error,
    "Partnership could not be dissolved.",
  );
}

async function markPartnershipWidowed(
  client: GubernatorSupabaseClient,
  input: MarkPartnershipWidowedInput,
): Promise<Partnership> {
  const values = parseInput(markPartnershipWidowedInputSchema, input);

  const { data, error } = await client
    .rpc("mark_partnership_widowed", {
      p_change_reason: values.changeReason,
      p_ended_on_turn_number: values.endedOnTurnNumber,
      p_partnership_id: values.partnershipId,
      p_turn_transition_id: values.turnTransitionId,
    })
    .maybeSingle<PartnershipRow>();

  return assertPartnershipRow(
    data,
    error,
    "Partnership could not be marked widowed.",
  );
}

async function reassignPartner(
  client: GubernatorSupabaseClient,
  input: ReassignPartnerInput,
): Promise<Partnership> {
  const values = parseInput(reassignPartnerInputSchema, input);

  const { data, error } = await client
    .rpc("reassign_partner", {
      p_change_reason: values.changeReason,
      p_ended_on_turn_number: values.endedOnTurnNumber,
      p_formed_on_turn_number: values.formedOnTurnNumber,
      p_new_partner_citizen_id: values.newPartnerCitizenId,
      p_old_partnership_id: values.oldPartnershipId,
      p_retained_citizen_id: values.retainedCitizenId,
      p_turn_transition_id: values.turnTransitionId,
    })
    .maybeSingle<PartnershipRow>();

  return assertPartnershipRow(
    data,
    error,
    "Partnership could not be reassigned.",
  );
}

function assertPartnershipRow(
  data: PartnershipRow | null,
  error: unknown,
  notFoundMessage: string,
): Partnership {
  if (error !== null && error !== undefined) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new PartnershipMutationError({
      code: "partnership_unauthorized",
      message: notFoundMessage,
    });
  }

  return toPartnership(data);
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new PartnershipMutationError({
        code: "partnership_input_invalid",
        issues,
        message: "Partnership input is invalid.",
      }),
  );
}
