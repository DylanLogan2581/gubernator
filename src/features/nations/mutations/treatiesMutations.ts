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

import { nationsQueryKeys } from "../queries/nationsQueryKeys";
import {
  toNationTreaty,
  type NationTreatyRow,
} from "../queries/treatiesQueries";
import {
  breakTreatyInputSchema,
  proposeTreatyInputSchema,
  respondToTreatyInputSchema,
  withdrawTreatyInputSchema,
  type BreakTreatyInput,
  type ProposeTreatyInput,
  type RespondToTreatyInput,
  type WithdrawTreatyInput,
} from "../schemas/treatiesSchemas";

import type { NationTreaty } from "../types/nationTreatyTypes";
import type { z } from "zod";

type NationTreatyMutationErrorCode =
  | "treaty_input_invalid"
  | "treaty_not_found";

type ProposeTreatyMutationOptions = UseMutationOptions<
  NationTreaty,
  AuthUiError | NationTreatyMutationError,
  ProposeTreatyInput
>;
type RespondToTreatyMutationOptions = UseMutationOptions<
  NationTreaty,
  AuthUiError | NationTreatyMutationError,
  RespondToTreatyInput
>;
type WithdrawTreatyMutationOptions = UseMutationOptions<
  NationTreaty,
  AuthUiError | NationTreatyMutationError,
  WithdrawTreatyInput
>;
type BreakTreatyMutationOptions = UseMutationOptions<
  NationTreaty,
  AuthUiError | NationTreatyMutationError,
  BreakTreatyInput
>;

export type NationTreatyMutationIssue = MutationIssue;

export const {
  ErrorClass: NationTreatyMutationError,
  isError: isNationTreatyMutationError,
} = createMutationError<NationTreatyMutationErrorCode>(
  "NationTreatyMutationError",
);
export type NationTreatyMutationError = InstanceType<
  typeof NationTreatyMutationError
>;

export function proposeTreatyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ProposeTreatyMutationOptions {
  return mutationOptions({
    mutationFn: (input: ProposeTreatyInput) => proposeTreaty(client, input),
    mutationKey: [...nationsQueryKeys.all, "propose-treaty"],
    onSuccess: (treaty) => invalidateTreatyCaches(queryClient, treaty),
  });
}

export function respondToTreatyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RespondToTreatyMutationOptions {
  return mutationOptions({
    mutationFn: (input: RespondToTreatyInput) => respondToTreaty(client, input),
    mutationKey: [...nationsQueryKeys.all, "respond-to-treaty"],
    onSuccess: (treaty) => invalidateTreatyCaches(queryClient, treaty),
  });
}

export function withdrawTreatyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): WithdrawTreatyMutationOptions {
  return mutationOptions({
    mutationFn: (input: WithdrawTreatyInput) => withdrawTreaty(client, input),
    mutationKey: [...nationsQueryKeys.all, "withdraw-treaty"],
    onSuccess: (treaty) => invalidateTreatyCaches(queryClient, treaty),
  });
}

export function breakTreatyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): BreakTreatyMutationOptions {
  return mutationOptions({
    mutationFn: (input: BreakTreatyInput) => breakTreaty(client, input),
    mutationKey: [...nationsQueryKeys.all, "break-treaty"],
    onSuccess: (treaty) => invalidateTreatyCaches(queryClient, treaty),
  });
}

async function proposeTreaty(
  client: GubernatorSupabaseClient,
  input: ProposeTreatyInput,
): Promise<NationTreaty> {
  const values = parseInput(proposeTreatyInputSchema, input);

  const terms =
    values.treatyType === "tribute"
      ? {
          payer: values.terms.payer,
          quantity_per_turn: values.terms.quantityPerTurn,
          resource_id: values.terms.resourceId,
        }
      : values.treatyType === "royal_marriage"
        ? {
            citizen_a_id: values.terms.citizenAId,
            citizen_b_id: values.terms.citizenBId,
          }
        : {};

  const { data, error } = await client
    .rpc("propose_nation_treaty", {
      p_duration_turns: values.durationTurns,
      p_proposed_by_citizen_id: values.proposedByCitizenId,
      p_proposer_nation_id: values.proposerNationId,
      p_responder_nation_id: values.responderNationId,
      p_terms: terms,
      p_treaty_type: values.treatyType,
    })
    .single<NationTreatyRow>();

  return assertTreatyRow(data, error, "Treaty could not be proposed.");
}

async function respondToTreaty(
  client: GubernatorSupabaseClient,
  input: RespondToTreatyInput,
): Promise<NationTreaty> {
  const values = parseInput(respondToTreatyInputSchema, input);

  const { data, error } = await client
    .rpc("respond_to_nation_treaty", {
      p_responded_by_citizen_id: values.respondedByCitizenId,
      p_response: values.response,
      p_treaty_id: values.treatyId,
    })
    .single<NationTreatyRow>();

  return assertTreatyRow(data, error, "Treaty response could not be recorded.");
}

async function withdrawTreaty(
  client: GubernatorSupabaseClient,
  input: WithdrawTreatyInput,
): Promise<NationTreaty> {
  const values = parseInput(withdrawTreatyInputSchema, input);

  const { data, error } = await client
    .rpc("withdraw_nation_treaty", {
      p_treaty_id: values.treatyId,
    })
    .single<NationTreatyRow>();

  return assertTreatyRow(data, error, "Treaty could not be withdrawn.");
}

async function breakTreaty(
  client: GubernatorSupabaseClient,
  input: BreakTreatyInput,
): Promise<NationTreaty> {
  const values = parseInput(breakTreatyInputSchema, input);

  const { data, error } = await client
    .rpc("break_nation_treaty", {
      p_broken_by_citizen_id: values.brokenByCitizenId,
      p_treaty_id: values.treatyId,
    })
    .single<NationTreatyRow>();

  return assertTreatyRow(data, error, "Treaty could not be broken.");
}

function assertTreatyRow(
  data: NationTreatyRow | null,
  error: unknown,
  notFoundMessage: string,
): NationTreaty {
  if (error !== null && error !== undefined) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationTreatyMutationError({
      code: "treaty_not_found",
      message: notFoundMessage,
    });
  }

  return toNationTreaty(data);
}

async function invalidateTreatyCaches(
  queryClient: QueryClient,
  treaty: NationTreaty,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.treaties(treaty.proposerNationId),
    }),
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.treaties(treaty.responderNationId),
    }),
  ]);
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new NationTreatyMutationError({
        code: "treaty_input_invalid",
        issues,
        message: "Treaty input is invalid.",
      }),
  );
}
