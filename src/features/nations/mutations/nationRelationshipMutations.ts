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
  | "relationship_already_accepted"
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

export type NationRelationshipMutationIssue = MutationIssue;

export const {
  ErrorClass: NationRelationshipMutationError,
  isError: isNationRelationshipMutationError,
} = createMutationError<NationRelationshipMutationErrorCode>(
  "NationRelationshipMutationError",
);
export type NationRelationshipMutationError = InstanceType<
  typeof NationRelationshipMutationError
>;

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
        world_id: values.worldId,
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

  // The already-accepted guard and pending_changed_by_citizen_id attribution
  // are enforced server-side by the nation_relationships_guard_propose
  // trigger (see supabase/migrations/20260811000000_guard_bilateral_relationship_propose.sql).
  // A client-side pre-check-then-upsert would be TOCTOU-prone: two concurrent
  // proposals could both read the pre-accept state before either writes.
  const { data, error } = await client
    .from("nation_relationships")
    .upsert(
      {
        from_nation_id: values.fromNationId,
        pending_stance: values.stance,
        pending_status: "proposed",
        to_nation_id: values.toNationId,
        world_id: values.worldId,
      },
      { onConflict: "from_nation_id,to_nation_id" },
    )
    .select(NATION_RELATIONSHIP_SELECT)
    .maybeSingle<NationRelationshipRow>();

  if (error !== null && error !== undefined && error.code === "P0001") {
    throw new NationRelationshipMutationError({
      code: "relationship_already_accepted",
      message:
        "This proposal has already been accepted. Withdraw the existing agreement before proposing again.",
    });
  }

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

  const { data, error } = await client
    .rpc("respond_to_bilateral", {
      p_from_nation_id: values.fromNationId,
      p_response: values.response,
      p_to_nation_id: values.toNationId,
    })
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

  // Decision (issue #954): current_stance resets to "neutral" on withdraw by
  // design, not by accident. nation_relationships has no separate column for
  // an "underlying" unilateral stance — current_stance is the single source
  // of truth, and forming a bilateral agreement already overwrote whatever
  // unilateral stance predated it (both directions, via the mirror trigger in
  // supabase/migrations/20260525000001_mirror_bilateral_nation_relationships.sql).
  // Withdraw cannot restore a value that was never retained, so resetting to
  // neutral is the correct and only recoverable state. The mirror trigger
  // applies the same reset to the symmetric row.
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
    throw normalizeSupabaseError(error);
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
      queryKey: nationsQueryKeys.relationshipsFromNation(
        relationship.toNationId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.relationshipsToNation(relationship.toNationId),
    }),
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.relationshipsToNation(
        relationship.fromNationId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.relationshipPair(
        relationship.fromNationId,
        relationship.toNationId,
      ),
    }),
    queryClient.invalidateQueries({
      queryKey: nationsQueryKeys.relationshipPair(
        relationship.toNationId,
        relationship.fromNationId,
      ),
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
      new NationRelationshipMutationError({
        code: "relationship_input_invalid",
        issues,
        message: "Nation relationship input is invalid.",
      }),
  );
}
