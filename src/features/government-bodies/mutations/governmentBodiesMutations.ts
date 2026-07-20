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

import { toDbComposition } from "../lib/governmentBodyCompositionMapper";
import { governmentBodiesQueryKeys } from "../queries/governmentBodiesQueryKeys";
import {
  createGovernmentBodyInputSchema,
  deleteGovernmentBodyInputSchema,
  updateGovernmentBodyInputSchema,
  type CreateGovernmentBodyInput,
  type UpdateGovernmentBodyInput as UpdateGovernmentBodyValuesInput,
} from "../schemas/governmentBodySchemas";

import type { z } from "zod";

// nationId / settlementId are not written by the update (only DB-immutable
// via RLS), but the mutation needs them to invalidate the right list query.
export type UpdateGovernmentBodyInput = UpdateGovernmentBodyValuesInput & {
  readonly nationId: string | null;
  readonly settlementId: string | null;
};

export type DeleteGovernmentBodyInput = {
  readonly id: string;
  readonly nationId: string | null;
  readonly settlementId: string | null;
};

type GovernmentBodyMutationErrorCode =
  | "government_body_input_invalid"
  | "government_body_write_blocked";

export type GovernmentBodyMutationIssue = MutationIssue;

export const {
  ErrorClass: GovernmentBodyMutationError,
  isError: isGovernmentBodyMutationError,
} = createMutationError<GovernmentBodyMutationErrorCode>(
  "GovernmentBodyMutationError",
);
export type GovernmentBodyMutationError = InstanceType<
  typeof GovernmentBodyMutationError
>;

export type CreateGovernmentBodyMutationOptions = UseMutationOptions<
  void,
  AuthUiError | GovernmentBodyMutationError,
  CreateGovernmentBodyInput
>;
export type UpdateGovernmentBodyMutationOptions = UseMutationOptions<
  void,
  AuthUiError | GovernmentBodyMutationError,
  UpdateGovernmentBodyInput
>;
export type DeleteGovernmentBodyMutationOptions = UseMutationOptions<
  void,
  AuthUiError | GovernmentBodyMutationError,
  DeleteGovernmentBodyInput
>;

function invalidateGovernmentBodyQueries(
  queryClient: QueryClient,
  {
    nationId,
    settlementId,
  }: { nationId: string | null; settlementId: string | null },
): Promise<void> {
  return Promise.all([
    nationId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: governmentBodiesQueryKeys.nationList(nationId),
        }),
    settlementId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: governmentBodiesQueryKeys.settlementList(settlementId),
        }),
  ]).then(() => undefined);
}

export function createGovernmentBodyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateGovernmentBodyMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateGovernmentBodyInput) =>
      createGovernmentBody(client, input),
    mutationKey: [...governmentBodiesQueryKeys.all, "create-government-body"],
    onSuccess: (_result, input) =>
      invalidateGovernmentBodyQueries(queryClient, {
        nationId: input.nationId,
        settlementId: input.settlementId,
      }),
  });
}

export function updateGovernmentBodyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateGovernmentBodyMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateGovernmentBodyInput) =>
      updateGovernmentBody(client, input),
    mutationKey: [...governmentBodiesQueryKeys.all, "update-government-body"],
    onSuccess: (_result, input) =>
      invalidateGovernmentBodyQueries(queryClient, {
        nationId: input.nationId,
        settlementId: input.settlementId,
      }),
  });
}

export function deleteGovernmentBodyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteGovernmentBodyMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteGovernmentBodyInput) =>
      deleteGovernmentBody(client, input),
    mutationKey: [...governmentBodiesQueryKeys.all, "delete-government-body"],
    onSuccess: (_result, input) =>
      invalidateGovernmentBodyQueries(queryClient, {
        nationId: input.nationId,
        settlementId: input.settlementId,
      }),
  });
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new GovernmentBodyMutationError({
        code: "government_body_input_invalid",
        issues,
        message: "Body composition is invalid.",
      }),
  );
}

// government_bodies CRUD authority is enforced entirely by RLS (#1116):
// nation managers write their nation's bodies, settlement managers write
// their settlement's bodies, world/super admins write either. RLS silently
// drops disallowed rows instead of raising, so every write re-selects the
// row and treats "not found" as blocked-by-RLS -- matching office_types.
async function createGovernmentBody(
  client: GubernatorSupabaseClient,
  input: CreateGovernmentBodyInput,
): Promise<void> {
  const values = parseInput(createGovernmentBodyInputSchema, input);

  const { data, error } = await client
    .from("government_bodies")
    .insert({
      composition_json: toDbComposition(values.composition),
      description: values.description ?? null,
      name: values.name.trim(),
      nation_id: values.nationId,
      settlement_id: values.settlementId,
      world_id: values.worldId,
    })
    .select("id")
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new GovernmentBodyMutationError({
      code: "government_body_write_blocked",
      message: "Body could not be created.",
    });
  }
}

async function updateGovernmentBody(
  client: GubernatorSupabaseClient,
  input: UpdateGovernmentBodyInput,
): Promise<void> {
  const values = parseInput(updateGovernmentBodyInputSchema, {
    composition: input.composition,
    description: input.description,
    id: input.id,
    name: input.name,
  });

  const { data, error } = await client
    .from("government_bodies")
    .update({
      composition_json: toDbComposition(values.composition),
      description: values.description ?? null,
      name: values.name.trim(),
    })
    .eq("id", values.id)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new GovernmentBodyMutationError({
      code: "government_body_write_blocked",
      message: "Body could not be updated.",
    });
  }
}

async function deleteGovernmentBody(
  client: GubernatorSupabaseClient,
  input: DeleteGovernmentBodyInput,
): Promise<void> {
  const values = parseInput(deleteGovernmentBodyInputSchema, input);

  const { data, error } = await client
    .from("government_bodies")
    .delete()
    .eq("id", values.id)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new GovernmentBodyMutationError({
      code: "government_body_write_blocked",
      message: "Body could not be deleted.",
    });
  }
}
