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

import { armiesQueryKeys } from "../queries/armiesQueryKeys";
import {
  toArmyGroup,
  toArmyUnit,
  type ArmyGroupRow,
  type ArmyUnitRow,
} from "../queries/armyRows";
import {
  createArmyGroupInputSchema,
  createArmyUnitInputSchema,
  deleteArmyGroupInputSchema,
  deleteArmyUnitInputSchema,
  moveArmyGroupInputSchema,
  moveArmyUnitInputSchema,
  renameArmyGroupInputSchema,
  renameArmyUnitInputSchema,
  type CreateArmyGroupInput,
  type CreateArmyUnitInput,
  type DeleteArmyGroupInput,
  type DeleteArmyUnitInput,
  type MoveArmyGroupInput,
  type MoveArmyUnitInput,
  type RenameArmyGroupInput,
  type RenameArmyUnitInput,
} from "../schemas/armyTreeSchemas";

import type { ArmyGroup, ArmyUnit } from "../types/armyTypes";
import type { z } from "zod";

type RpcErrorLike = {
  readonly code?: string | null;
  readonly hint?: string | null;
  readonly message: string;
};

type RpcResult<TRow> =
  | { readonly data: TRow; readonly error: null }
  | { readonly data: null; readonly error: RpcErrorLike };

// Some army-tree RPCs take a nullable uuid param (null = army root) that the
// generated Functions.Args type widens to a non-null string, since Postgres
// function args can't declare NOT NULL. Calling through this narrower
// signature (rather than `as any`) keeps the rest of the call site
// type-checked -- only the args bag itself is loosely typed.
type UnsafeNullableRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

type ArmyTreeMutationErrorCode =
  | "army_tree_depth_exceeded"
  | "army_tree_forbidden"
  | "army_tree_group_not_empty"
  | "army_tree_input_invalid"
  | "army_tree_not_found"
  | "army_tree_rejected"
  | "army_tree_unit_not_empty"
  | "world_archived";

export type ArmyTreeMutationIssue = MutationIssue;

export const {
  ErrorClass: ArmyTreeMutationError,
  isError: isArmyTreeMutationError,
} = createMutationError<ArmyTreeMutationErrorCode>("ArmyTreeMutationError");
export type ArmyTreeMutationError = InstanceType<typeof ArmyTreeMutationError>;

export type DeleteArmyGroupResult = { readonly groupId: string };
export type DeleteArmyUnitResult = { readonly unitId: string };

function invalidateArmyTree(
  queryClient: QueryClient,
  armyId: string,
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: armiesQueryKeys.groupsByArmy(armyId),
    }),
    queryClient.invalidateQueries({
      queryKey: armiesQueryKeys.unitsByArmy(armyId),
    }),
  ]).then(() => undefined);
}

// --- Groups ----------------------------------------------------------------

type CreateArmyGroupMutationOptions = UseMutationOptions<
  ArmyGroup,
  AuthUiError | ArmyTreeMutationError,
  CreateArmyGroupInput
>;
type RenameArmyGroupMutationOptions = UseMutationOptions<
  ArmyGroup,
  AuthUiError | ArmyTreeMutationError,
  RenameArmyGroupInput
>;
type MoveArmyGroupMutationOptions = UseMutationOptions<
  ArmyGroup,
  AuthUiError | ArmyTreeMutationError,
  MoveArmyGroupInput
>;
type DeleteArmyGroupMutationOptions = UseMutationOptions<
  DeleteArmyGroupResult,
  AuthUiError | ArmyTreeMutationError,
  DeleteArmyGroupInput
>;

export function createArmyGroupMutationOptions({
  armyId,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly armyId: string;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateArmyGroupMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateArmyGroupInput) => createArmyGroup(client, input),
    mutationKey: [...armiesQueryKeys.all, "create-army-group"],
    onSuccess: () => invalidateArmyTree(queryClient, armyId),
  });
}

export function renameArmyGroupMutationOptions({
  armyId,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly armyId: string;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RenameArmyGroupMutationOptions {
  return mutationOptions({
    mutationFn: (input: RenameArmyGroupInput) => renameArmyGroup(client, input),
    mutationKey: [...armiesQueryKeys.all, "rename-army-group"],
    onSuccess: () => invalidateArmyTree(queryClient, armyId),
  });
}

export function moveArmyGroupMutationOptions({
  armyId,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly armyId: string;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): MoveArmyGroupMutationOptions {
  return mutationOptions({
    mutationFn: (input: MoveArmyGroupInput) => moveArmyGroup(client, input),
    mutationKey: [...armiesQueryKeys.all, "move-army-group"],
    onSuccess: () => invalidateArmyTree(queryClient, armyId),
  });
}

export function deleteArmyGroupMutationOptions({
  armyId,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly armyId: string;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteArmyGroupMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteArmyGroupInput) => deleteArmyGroup(client, input),
    mutationKey: [...armiesQueryKeys.all, "delete-army-group"],
    onSuccess: () => invalidateArmyTree(queryClient, armyId),
  });
}

async function createArmyGroup(
  client: GubernatorSupabaseClient,
  input: CreateArmyGroupInput,
): Promise<ArmyGroup> {
  const values = parseInput(createArmyGroupInputSchema, input);

  // p_parent_group_id is nullable at the DB level (null = army root), but the
  // generated Functions.Args type widens all uuid params to non-null string
  // -- cast the call, matching the existing pattern for nullable RPC args
  // (see cancel_event_or_group in eventMutations.ts).
  const { data, error } = (await (client.rpc as unknown as UnsafeNullableRpc)(
    "create_army_group",
    {
      p_army_id: values.armyId,
      p_name: values.name.trim(),
      p_parent_group_id: values.parentGroupId,
      p_sort_order: values.sortOrder,
    },
  )) as RpcResult<ArmyGroupRow>;

  if (error !== null) {
    throw translateArmyTreeError(error);
  }

  return toArmyGroup(data);
}

async function renameArmyGroup(
  client: GubernatorSupabaseClient,
  input: RenameArmyGroupInput,
): Promise<ArmyGroup> {
  const values = parseInput(renameArmyGroupInputSchema, input);

  const { data, error } = await client.rpc("rename_army_group", {
    p_group_id: values.groupId,
    p_name: values.name.trim(),
  });

  if (error !== null) {
    throw translateArmyTreeError(error);
  }

  return toArmyGroup(data);
}

async function moveArmyGroup(
  client: GubernatorSupabaseClient,
  input: MoveArmyGroupInput,
): Promise<ArmyGroup> {
  const values = parseInput(moveArmyGroupInputSchema, input);

  const { data, error } = (await (client.rpc as unknown as UnsafeNullableRpc)(
    "move_army_group",
    {
      p_group_id: values.groupId,
      p_new_parent_group_id: values.newParentGroupId,
    },
  )) as RpcResult<ArmyGroupRow>;

  if (error !== null) {
    throw translateArmyTreeError(error);
  }

  return toArmyGroup(data);
}

async function deleteArmyGroup(
  client: GubernatorSupabaseClient,
  input: DeleteArmyGroupInput,
): Promise<DeleteArmyGroupResult> {
  const values = parseInput(deleteArmyGroupInputSchema, input);

  const { error } = await client.rpc("delete_army_group", {
    p_group_id: values.groupId,
  });

  if (error !== null) {
    throw translateArmyTreeError(error);
  }

  return { groupId: values.groupId };
}

// --- Units -------------------------------------------------------------

type CreateArmyUnitMutationOptions = UseMutationOptions<
  ArmyUnit,
  AuthUiError | ArmyTreeMutationError,
  CreateArmyUnitInput
>;
type RenameArmyUnitMutationOptions = UseMutationOptions<
  ArmyUnit,
  AuthUiError | ArmyTreeMutationError,
  RenameArmyUnitInput
>;
type MoveArmyUnitMutationOptions = UseMutationOptions<
  ArmyUnit,
  AuthUiError | ArmyTreeMutationError,
  MoveArmyUnitInput
>;
type DeleteArmyUnitMutationOptions = UseMutationOptions<
  DeleteArmyUnitResult,
  AuthUiError | ArmyTreeMutationError,
  DeleteArmyUnitInput
>;

export function createArmyUnitMutationOptions({
  armyId,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly armyId: string;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateArmyUnitMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateArmyUnitInput) => createArmyUnit(client, input),
    mutationKey: [...armiesQueryKeys.all, "create-army-unit"],
    onSuccess: () => invalidateArmyTree(queryClient, armyId),
  });
}

export function renameArmyUnitMutationOptions({
  armyId,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly armyId: string;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RenameArmyUnitMutationOptions {
  return mutationOptions({
    mutationFn: (input: RenameArmyUnitInput) => renameArmyUnit(client, input),
    mutationKey: [...armiesQueryKeys.all, "rename-army-unit"],
    onSuccess: () => invalidateArmyTree(queryClient, armyId),
  });
}

export function moveArmyUnitMutationOptions({
  armyId,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly armyId: string;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): MoveArmyUnitMutationOptions {
  return mutationOptions({
    mutationFn: (input: MoveArmyUnitInput) => moveArmyUnit(client, input),
    mutationKey: [...armiesQueryKeys.all, "move-army-unit"],
    onSuccess: () => invalidateArmyTree(queryClient, armyId),
  });
}

export function deleteArmyUnitMutationOptions({
  armyId,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly armyId: string;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteArmyUnitMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteArmyUnitInput) => deleteArmyUnit(client, input),
    mutationKey: [...armiesQueryKeys.all, "delete-army-unit"],
    onSuccess: () => invalidateArmyTree(queryClient, armyId),
  });
}

async function createArmyUnit(
  client: GubernatorSupabaseClient,
  input: CreateArmyUnitInput,
): Promise<ArmyUnit> {
  const values = parseInput(createArmyUnitInputSchema, input);

  const { data, error } = (await (client.rpc as unknown as UnsafeNullableRpc)(
    "create_army_unit",
    {
      p_army_id: values.armyId,
      p_group_id: values.groupId,
      p_name: values.name.trim(),
      p_sort_order: values.sortOrder,
      p_unit_type_id: values.unitTypeId,
    },
  )) as RpcResult<ArmyUnitRow>;

  if (error !== null) {
    throw translateArmyTreeError(error);
  }

  return toArmyUnit(data);
}

async function renameArmyUnit(
  client: GubernatorSupabaseClient,
  input: RenameArmyUnitInput,
): Promise<ArmyUnit> {
  const values = parseInput(renameArmyUnitInputSchema, input);

  const { data, error } = await client.rpc("rename_army_unit", {
    p_name: values.name.trim(),
    p_unit_id: values.unitId,
  });

  if (error !== null) {
    throw translateArmyTreeError(error);
  }

  return toArmyUnit(data);
}

async function moveArmyUnit(
  client: GubernatorSupabaseClient,
  input: MoveArmyUnitInput,
): Promise<ArmyUnit> {
  const values = parseInput(moveArmyUnitInputSchema, input);

  const { data, error } = (await (client.rpc as unknown as UnsafeNullableRpc)(
    "move_army_unit",
    {
      p_group_id: values.groupId,
      p_sort_order: values.sortOrder,
      p_unit_id: values.unitId,
    },
  )) as RpcResult<ArmyUnitRow>;

  if (error !== null) {
    throw translateArmyTreeError(error);
  }

  return toArmyUnit(data);
}

async function deleteArmyUnit(
  client: GubernatorSupabaseClient,
  input: DeleteArmyUnitInput,
): Promise<DeleteArmyUnitResult> {
  const values = parseInput(deleteArmyUnitInputSchema, input);

  const { error } = await client.rpc("delete_army_unit", {
    p_unit_id: values.unitId,
  });

  if (error !== null) {
    throw translateArmyTreeError(error);
  }

  return { unitId: values.unitId };
}

function translateArmyTreeError(error: {
  readonly code?: string | null;
  readonly hint?: string | null;
  readonly message: string;
}): Error {
  if (error.code === "42501") {
    return new ArmyTreeMutationError({
      code: "army_tree_forbidden",
      message: "You do not have permission to manage this nation's military.",
    });
  }
  if (error.code === "P0002") {
    return new ArmyTreeMutationError({
      code: "army_tree_not_found",
      message: "Army, group, or unit not found.",
    });
  }
  if (error.hint === "world_archived") {
    return new ArmyTreeMutationError({
      code: "world_archived",
      message: "This world is archived and read-only.",
    });
  }
  if (error.hint === "depth_exceeded") {
    return new ArmyTreeMutationError({
      code: "army_tree_depth_exceeded",
      message: "Groups can only be nested 5 levels deep.",
    });
  }
  if (error.hint === "group_not_empty") {
    return new ArmyTreeMutationError({
      code: "army_tree_group_not_empty",
      message:
        "Group must have no child groups or units before it can be deleted.",
    });
  }
  if (error.hint === "unit_not_empty") {
    return new ArmyTreeMutationError({
      code: "army_tree_unit_not_empty",
      message: "Unit must have no soldiers before it can be deleted.",
    });
  }
  if (error.code === "22023") {
    return new ArmyTreeMutationError({
      code: "army_tree_rejected",
      message: error.message,
    });
  }
  return normalizeSupabaseError(error);
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ArmyTreeMutationError({
        code: "army_tree_input_invalid",
        issues,
        message: "Input is invalid.",
      }),
  );
}
