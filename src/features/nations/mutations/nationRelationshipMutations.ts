import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import {
  toNationRelationship,
  type NationRelationshipRow,
} from "../queries/nationRelationshipQueries";
import { nationsQueryKeys } from "../queries/nationsQueryKeys";
import {
  proposeBilateralInputSchema,
  respondToBilateralInputSchema,
  setUnilateralStanceInputSchema,
  withdrawFromBilateralInputSchema,
  type ProposeBilateralInput,
  type RespondToBilateralInput,
  type SetUnilateralStanceInput,
  type WithdrawFromBilateralInput,
} from "../schemas/nationRelationshipSchemas";

import type { NationRelationship } from "../types/nationRelationshipTypes";
import type { z } from "zod";

type NationRelationshipMutationErrorCode =
  | "relationship_input_invalid"
  | "relationship_not_found";

type SetUnilateralStanceMutationOptions = UseMutationOptions<
  NationRelationship,
  AuthUiError | NationRelationshipMutationError,
  SetUnilateralStanceInput
>;
type ProposeBilateralMutationOptions = UseMutationOptions<
  NationRelationship,
  AuthUiError | NationRelationshipMutationError,
  ProposeBilateralInput
>;
type RespondToBilateralMutationOptions = UseMutationOptions<
  NationRelationship,
  AuthUiError | NationRelationshipMutationError,
  RespondToBilateralInput
>;
type WithdrawFromBilateralMutationOptions = UseMutationOptions<
  NationRelationship,
  AuthUiError | NationRelationshipMutationError,
  WithdrawFromBilateralInput
>;

const NATION_RELATIONSHIP_SELECT =
  "id,from_nation_id,to_nation_id,current_stance,pending_stance,pending_status,pending_changed_by_citizen_id,created_at,updated_at";

export type NationRelationshipMutationIssue = {
  readonly message: string;
  readonly path: readonly PropertyKey[];
};

export class NationRelationshipMutationError extends Error {
  readonly code: NationRelationshipMutationErrorCode;
  readonly issues: readonly NationRelationshipMutationIssue[];

  constructor({
    code,
    issues = [],
    message,
  }: {
    readonly code: NationRelationshipMutationErrorCode;
    readonly issues?: readonly NationRelationshipMutationIssue[];
    readonly message: string;
  }) {
    super(message);
    this.name = "NationRelationshipMutationError";
    this.code = code;
    this.issues = issues;
  }
}

export function isNationRelationshipMutationError(
  error: unknown,
): error is NationRelationshipMutationError {
  return error instanceof NationRelationshipMutationError;
}

export function setUnilateralStanceMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetUnilateralStanceMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetUnilateralStanceInput) =>
      setUnilateralStance(client, input),
    mutationKey: [...nationsQueryKeys.all, "set-unilateral-stance"],
    onSuccess: (relationship) =>
      invalidateRelationshipCaches(queryClient, relationship),
  });
}

export function proposeBilateralMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ProposeBilateralMutationOptions {
  return mutationOptions({
    mutationFn: (input: ProposeBilateralInput) =>
      proposeBilateral(client, input),
    mutationKey: [...nationsQueryKeys.all, "propose-bilateral"],
    onSuccess: (relationship) =>
      invalidateRelationshipCaches(queryClient, relationship),
  });
}

export function respondToBilateralMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RespondToBilateralMutationOptions {
  return mutationOptions({
    mutationFn: (input: RespondToBilateralInput) =>
      respondToBilateral(client, input),
    mutationKey: [...nationsQueryKeys.all, "respond-to-bilateral"],
    onSuccess: (relationship) =>
      invalidateRelationshipCaches(queryClient, relationship),
  });
}

export function withdrawFromBilateralMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): WithdrawFromBilateralMutationOptions {
  return mutationOptions({
    mutationFn: (input: WithdrawFromBilateralInput) =>
      withdrawFromBilateral(client, input),
    mutationKey: [...nationsQueryKeys.all, "withdraw-from-bilateral"],
    onSuccess: (relationship) =>
      invalidateRelationshipCaches(queryClient, relationship),
  });
}

async function setUnilateralStance(
  client: GubernatorSupabaseClient,
  input: SetUnilateralStanceInput,
): Promise<NationRelationship> {
  const values = parseInput(setUnilateralStanceInputSchema, input);

  const { data, error } = await client
    .from("nation_relationships")
    .upsert(
      {
        current_stance: values.stance,
        from_nation_id: values.fromNationId,
        pending_changed_by_citizen_id: null,
        pending_stance: null,
        pending_status: null,
        to_nation_id: values.toNationId,
      },
      { onConflict: "from_nation_id,to_nation_id" },
    )
    .select(NATION_RELATIONSHIP_SELECT)
    .maybeSingle<NationRelationshipRow>();

  return assertRelationshipRow(
    data,
    error,
    "Nation relationship could not be updated.",
  );
}

async function proposeBilateral(
  client: GubernatorSupabaseClient,
  input: ProposeBilateralInput,
): Promise<NationRelationship> {
  const values = parseInput(proposeBilateralInputSchema, input);

  const { data, error } = await client
    .from("nation_relationships")
    .upsert(
      {
        from_nation_id: values.fromNationId,
        pending_stance: values.stance,
        pending_status: "proposed",
        to_nation_id: values.toNationId,
      },
      { onConflict: "from_nation_id,to_nation_id" },
    )
    .select(NATION_RELATIONSHIP_SELECT)
    .maybeSingle<NationRelationshipRow>();

  return assertRelationshipRow(
    data,
    error,
    "Nation relationship proposal could not be recorded.",
  );
}

async function respondToBilateral(
  client: GubernatorSupabaseClient,
  input: RespondToBilateralInput,
): Promise<NationRelationship> {
  const values = parseInput(respondToBilateralInputSchema, input);

  const existing = await client
    .from("nation_relationships")
    .select("pending_stance")
    .eq("from_nation_id", values.fromNationId)
    .eq("to_nation_id", values.toNationId)
    .maybeSingle<{ readonly pending_stance: string | null }>();

  if (existing.error !== null) {
    throw normalizeAuthError(existing.error);
  }

  if (existing.data === null || existing.data.pending_stance === null) {
    throw new NationRelationshipMutationError({
      code: "relationship_not_found",
      message: "No pending proposal exists for this nation pair.",
    });
  }

  const accepted = values.response === "accepted";
  const update: {
    current_stance?: string;
    pending_stance: string | null;
    pending_status: string;
  } = {
    pending_stance: accepted ? existing.data.pending_stance : null,
    pending_status: values.response,
  };

  if (accepted) {
    update.current_stance = existing.data.pending_stance;
  }

  const { data, error } = await client
    .from("nation_relationships")
    .update(update)
    .eq("from_nation_id", values.fromNationId)
    .eq("to_nation_id", values.toNationId)
    .select(NATION_RELATIONSHIP_SELECT)
    .maybeSingle<NationRelationshipRow>();

  return assertRelationshipRow(
    data,
    error,
    "Nation relationship response could not be recorded.",
  );
}

async function withdrawFromBilateral(
  client: GubernatorSupabaseClient,
  input: WithdrawFromBilateralInput,
): Promise<NationRelationship> {
  const values = parseInput(withdrawFromBilateralInputSchema, input);

  const { data, error } = await client
    .from("nation_relationships")
    .update({
      current_stance: "neutral",
      pending_changed_by_citizen_id: null,
      pending_stance: null,
      pending_status: "withdrawn",
    })
    .eq("from_nation_id", values.fromNationId)
    .eq("to_nation_id", values.toNationId)
    .select(NATION_RELATIONSHIP_SELECT)
    .maybeSingle<NationRelationshipRow>();

  return assertRelationshipRow(
    data,
    error,
    "Nation relationship could not be withdrawn.",
  );
}

function assertRelationshipRow(
  data: NationRelationshipRow | null,
  error: unknown,
  notFoundMessage: string,
): NationRelationship {
  if (error !== null && error !== undefined) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    throw new NationRelationshipMutationError({
      code: "relationship_not_found",
      message: notFoundMessage,
    });
  }

  return toNationRelationship(data);
}

async function invalidateRelationshipCaches(
  queryClient: QueryClient,
  relationship: NationRelationship,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.relationshipsFromNation(
        relationship.fromNationId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.relationshipPair(
        relationship.fromNationId,
        relationship.toNationId,
      ),
    }),
  ]);
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new NationRelationshipMutationError({
      code: "relationship_input_invalid",
      issues: result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
      message: "Nation relationship input is invalid.",
    });
  }

  return result.data;
}
