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

import { nationOfficesQueryKeys } from "../queries/nationOfficesQueryKeys";
import {
  createOfficeTypeInputSchema,
  updateOfficeTypeInputSchema,
  type CreateOfficeTypeInput,
  type UpdateOfficeTypeInput,
} from "../schemas/officeTypesSchemas";

import type { z } from "zod";

export type { CreateOfficeTypeInput, UpdateOfficeTypeInput };

export type DeleteOfficeTypeInput = {
  readonly id: string;
  readonly nationId: string | null;
  readonly worldId: string;
};

type OfficeTypeMutationErrorCode =
  | "office_type_input_invalid"
  | "office_type_write_blocked";

export type OfficeTypeMutationIssue = MutationIssue;

export const {
  ErrorClass: OfficeTypeMutationError,
  isError: isOfficeTypeMutationError,
} = createMutationError<OfficeTypeMutationErrorCode>("OfficeTypeMutationError");
export type OfficeTypeMutationError = InstanceType<
  typeof OfficeTypeMutationError
>;

export type CreateOfficeTypeMutationOptions = UseMutationOptions<
  void,
  AuthUiError | OfficeTypeMutationError,
  CreateOfficeTypeInput
>;
export type UpdateOfficeTypeMutationOptions = UseMutationOptions<
  void,
  AuthUiError | OfficeTypeMutationError,
  UpdateOfficeTypeInput
>;
export type DeleteOfficeTypeMutationOptions = UseMutationOptions<
  void,
  AuthUiError | OfficeTypeMutationError,
  DeleteOfficeTypeInput
>;

function invalidateOfficeTypeQueries(
  queryClient: QueryClient,
  { nationId, worldId }: { nationId: string | null; worldId: string },
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: nationOfficesQueryKeys.officeTypesWorldDefaults(worldId),
    }),
    nationId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.officeTypes(worldId, nationId),
        }),
    nationId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: nationOfficesQueryKeys.officeTypesForSettlements(
            worldId,
            nationId,
          ),
        }),
  ]).then(() => undefined);
}

export function createOfficeTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateOfficeTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateOfficeTypeInput) =>
      createOfficeType(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "create-office-type"],
    onSuccess: (_result, input) =>
      invalidateOfficeTypeQueries(queryClient, input),
  });
}

export function updateOfficeTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateOfficeTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateOfficeTypeInput) =>
      updateOfficeType(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "update-office-type"],
    onSuccess: (_result, input) =>
      invalidateOfficeTypeQueries(queryClient, input),
  });
}

export function deleteOfficeTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteOfficeTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteOfficeTypeInput) =>
      deleteOfficeType(client, input),
    mutationKey: [...nationOfficesQueryKeys.all, "delete-office-type"],
    onSuccess: (_result, input) =>
      invalidateOfficeTypeQueries(queryClient, input),
  });
}

// office_types CRUD authority is enforced entirely by RLS (#1114): world
// admins write nation_id-null rows, nation managers write their own
// nation's rows; DELETE additionally requires no active holders. RLS
// silently drops disallowed rows instead of raising, so every write
// re-selects the row and treats "not found" as blocked-by-RLS.
async function createOfficeType(
  client: GubernatorSupabaseClient,
  input: CreateOfficeTypeInput,
): Promise<void> {
  const values = parseInput(createOfficeTypeInputSchema, input);

  const { data, error } = await client
    .from("office_types")
    .insert({
      color: values.color ?? null,
      default_term_turns: values.defaultTermTurns ?? null,
      description: values.description ?? null,
      excludes_from_labor: values.excludesFromLabor,
      icon: values.icon ?? null,
      max_holders: values.maxHolders ?? null,
      name: values.name,
      nation_id: values.nationId,
      scope: values.scope,
      world_id: values.worldId,
    })
    .select("id")
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new OfficeTypeMutationError({
      code: "office_type_write_blocked",
      message: "Office type could not be created.",
    });
  }
}

async function updateOfficeType(
  client: GubernatorSupabaseClient,
  input: UpdateOfficeTypeInput,
): Promise<void> {
  const values = parseInput(updateOfficeTypeInputSchema, input);

  const patch: Record<string, unknown> = {};
  if (values.name !== undefined) patch.name = values.name;
  if (values.description !== undefined) patch.description = values.description;
  if (values.icon !== undefined) patch.icon = values.icon;
  if (values.color !== undefined) patch.color = values.color;
  if (values.maxHolders !== undefined) patch.max_holders = values.maxHolders;
  if (values.excludesFromLabor !== undefined) {
    patch.excludes_from_labor = values.excludesFromLabor;
  }
  if (values.defaultTermTurns !== undefined) {
    patch.default_term_turns = values.defaultTermTurns;
  }

  const { data, error } = await client
    .from("office_types")
    .update(patch)
    .eq("id", values.id)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new OfficeTypeMutationError({
      code: "office_type_write_blocked",
      message: "Office type could not be updated.",
    });
  }
}

async function deleteOfficeType(
  client: GubernatorSupabaseClient,
  input: DeleteOfficeTypeInput,
): Promise<void> {
  const { data, error } = await client
    .from("office_types")
    .delete()
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new OfficeTypeMutationError({
      code: "office_type_write_blocked",
      message:
        "Office type could not be deleted. It may still have active holders.",
    });
  }
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new OfficeTypeMutationError({
        code: "office_type_input_invalid",
        issues,
        message: "Office type input is invalid.",
      }),
  );
}
