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
import { toArmy } from "../queries/armyRows";
import {
  createArmyInputSchema,
  deleteArmyInputSchema,
  moveArmyInputSchema,
  renameArmyInputSchema,
  type CreateArmyInput,
  type DeleteArmyInput,
  type MoveArmyInput,
  type RenameArmyInput,
} from "../schemas/armySchemas";

import type { Army } from "../types/armyTypes";
import type { z } from "zod";

type ArmyMutationErrorCode =
  | "army_forbidden"
  | "army_input_invalid"
  | "army_not_empty"
  | "army_not_found"
  | "army_rejected"
  | "settlement_not_in_nation"
  | "world_archived";

export type ArmyMutationIssue = MutationIssue;

export const { ErrorClass: ArmyMutationError, isError: isArmyMutationError } =
  createMutationError<ArmyMutationErrorCode>("ArmyMutationError");
export type ArmyMutationError = InstanceType<typeof ArmyMutationError>;

export type DeleteArmyResult = { readonly armyId: string };

type CreateArmyMutationOptions = UseMutationOptions<
  Army,
  AuthUiError | ArmyMutationError,
  CreateArmyInput
>;
type RenameArmyMutationOptions = UseMutationOptions<
  Army,
  AuthUiError | ArmyMutationError,
  RenameArmyInput
>;
type MoveArmyMutationOptions = UseMutationOptions<
  Army,
  AuthUiError | ArmyMutationError,
  MoveArmyInput
>;
type DeleteArmyMutationOptions = UseMutationOptions<
  DeleteArmyResult,
  AuthUiError | ArmyMutationError,
  DeleteArmyInput
>;

export function createArmyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateArmyMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateArmyInput) => createArmy(client, input),
    mutationKey: [...armiesQueryKeys.all, "create-army"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: armiesQueryKeys.all,
      });
    },
  });
}

export function renameArmyMutationOptions({
  client = requireSupabaseClient(),
  nationId,
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly nationId: string;
  readonly queryClient: QueryClient;
}): RenameArmyMutationOptions {
  return mutationOptions({
    mutationFn: (input: RenameArmyInput) => renameArmy(client, input),
    mutationKey: [...armiesQueryKeys.all, "rename-army"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: armiesQueryKeys.byNation(nationId),
      });
    },
  });
}

export function moveArmyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): MoveArmyMutationOptions {
  return mutationOptions({
    mutationFn: (input: MoveArmyInput) => moveArmy(client, input),
    mutationKey: [...armiesQueryKeys.all, "move-army"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: armiesQueryKeys.all,
      });
    },
  });
}

export function deleteArmyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteArmyMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteArmyInput) => deleteArmy(client, input),
    mutationKey: [...armiesQueryKeys.all, "delete-army"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: armiesQueryKeys.all,
      });
    },
  });
}

async function createArmy(
  client: GubernatorSupabaseClient,
  input: CreateArmyInput,
): Promise<Army> {
  const values = parseInput(createArmyInputSchema, input);

  const { data, error } = await client.rpc("create_army", {
    p_funding_source: values.fundingSource,
    p_name: values.name.trim(),
    p_nation_id: values.nationId,
    p_stationed_settlement_id: values.stationedSettlementId,
  });

  if (error !== null) {
    throw translateArmyError(error);
  }

  return toArmy(data);
}

async function renameArmy(
  client: GubernatorSupabaseClient,
  input: RenameArmyInput,
): Promise<Army> {
  const values = parseInput(renameArmyInputSchema, input);

  const { data, error } = await client.rpc("rename_army", {
    p_army_id: values.armyId,
    p_name: values.name.trim(),
  });

  if (error !== null) {
    throw translateArmyError(error);
  }

  return toArmy(data);
}

async function moveArmy(
  client: GubernatorSupabaseClient,
  input: MoveArmyInput,
): Promise<Army> {
  const values = parseInput(moveArmyInputSchema, input);

  const { data, error } = await client.rpc("move_army", {
    p_army_id: values.armyId,
    p_settlement_id: values.settlementId,
  });

  if (error !== null) {
    throw translateArmyError(error);
  }

  return toArmy(data);
}

async function deleteArmy(
  client: GubernatorSupabaseClient,
  input: DeleteArmyInput,
): Promise<DeleteArmyResult> {
  const values = parseInput(deleteArmyInputSchema, input);

  const { error } = await client.rpc("delete_army", {
    p_army_id: values.armyId,
  });

  if (error !== null) {
    throw translateArmyError(error);
  }

  return { armyId: values.armyId };
}

function translateArmyError(error: {
  readonly code?: string | null;
  readonly hint?: string | null;
  readonly message: string;
}): Error {
  if (error.code === "42501") {
    return new ArmyMutationError({
      code: "army_forbidden",
      message: "You do not have permission to manage this nation's military.",
    });
  }
  if (error.code === "P0002") {
    return new ArmyMutationError({
      code: "army_not_found",
      message: "Army or nation not found.",
    });
  }
  if (error.hint === "world_archived") {
    return new ArmyMutationError({
      code: "world_archived",
      message: "This world is archived and read-only.",
    });
  }
  if (error.hint === "settlement_not_in_nation") {
    return new ArmyMutationError({
      code: "settlement_not_in_nation",
      message: "The stationed settlement must belong to this nation.",
    });
  }
  if (error.hint === "army_not_empty") {
    return new ArmyMutationError({
      code: "army_not_empty",
      message: "Army must have no groups or units before it can be deleted.",
    });
  }
  if (error.code === "22023") {
    return new ArmyMutationError({
      code: "army_rejected",
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
      new ArmyMutationError({
        code: "army_input_invalid",
        issues,
        message: "Army input is invalid.",
      }),
  );
}
