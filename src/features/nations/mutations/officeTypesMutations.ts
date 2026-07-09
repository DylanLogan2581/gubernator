import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationOfficesQueryKeys } from "../queries/nationOfficesQueryKeys";

import type { OfficeTypeScope } from "../types/nationOfficeTypes";

export type CreateOfficeTypeInput = {
  readonly color?: string | null;
  // #1123: prefills the appoint dialog's term field. Null = indefinite.
  readonly defaultTermTurns?: number | null;
  readonly description?: string | null;
  readonly excludesFromLabor: boolean;
  readonly icon?: string | null;
  readonly maxHolders?: number | null;
  readonly name: string;
  // null = world-default office type (world admin only); set = custom
  // office type owned by that nation (that nation's manager only).
  readonly nationId: string | null;
  readonly scope: OfficeTypeScope;
  readonly worldId: string;
};

export type UpdateOfficeTypeInput = {
  readonly color?: string | null;
  readonly defaultTermTurns?: number | null;
  readonly description?: string | null;
  readonly excludesFromLabor?: boolean;
  readonly icon?: string | null;
  readonly id: string;
  readonly maxHolders?: number | null;
  readonly name?: string;
  readonly nationId: string | null;
  readonly worldId: string;
};

export type DeleteOfficeTypeInput = {
  readonly id: string;
  readonly nationId: string | null;
  readonly worldId: string;
};

export type OfficeTypeMutationIssue = MutationIssue;

export const {
  ErrorClass: OfficeTypeMutationError,
  isError: isOfficeTypeMutationError,
} = createMutationError<"office_type_write_blocked">("OfficeTypeMutationError");
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
  const { data, error } = await client
    .from("office_types")
    .insert({
      color: input.color ?? null,
      default_term_turns: input.defaultTermTurns ?? null,
      description: input.description ?? null,
      excludes_from_labor: input.excludesFromLabor,
      icon: input.icon ?? null,
      max_holders: input.maxHolders ?? null,
      name: input.name,
      nation_id: input.nationId,
      scope: input.scope,
      world_id: input.worldId,
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
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.maxHolders !== undefined) patch.max_holders = input.maxHolders;
  if (input.excludesFromLabor !== undefined) {
    patch.excludes_from_labor = input.excludesFromLabor;
  }
  if (input.defaultTermTurns !== undefined) {
    patch.default_term_turns = input.defaultTermTurns;
  }

  const { data, error } = await client
    .from("office_types")
    .update(patch)
    .eq("id", input.id)
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
