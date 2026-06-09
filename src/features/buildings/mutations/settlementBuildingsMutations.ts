import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { buildingsQueryKeys } from "../queries/buildingsQueryKeys";
import {
  manualDeconstructBuildingInputSchema,
  restoreSettlementBuildingInputSchema,
  hardDeleteSettlementBuildingInputSchema,
  type ManualDeconstructBuildingInput,
  type RestoreSettlementBuildingInput,
  type HardDeleteSettlementBuildingInput,
} from "../schemas/manualDeconstructBuildingSchemas";

import type {
  ManualDeconstructBuildingResult,
  RestoreSettlementBuildingResult,
  HardDeleteSettlementBuildingResult,
} from "../types/settlementBuildingTypes";
import type { z } from "zod";

type ManualDeconstructBuildingMutationErrorCode =
  | "manual_deconstruct_building_input_invalid"
  | "manual_deconstruct_building_not_authorized"
  | "manual_deconstruct_building_not_found"
  | "manual_deconstruct_building_wrong_state";

export type ManualDeconstructBuildingMutationIssue = MutationIssue;

export const {
  ErrorClass: ManualDeconstructBuildingMutationError,
  isError: isManualDeconstructBuildingMutationError,
} = createMutationError<ManualDeconstructBuildingMutationErrorCode>(
  "ManualDeconstructBuildingMutationError",
);
export type ManualDeconstructBuildingMutationError = InstanceType<
  typeof ManualDeconstructBuildingMutationError
>;

type RestoreSettlementBuildingMutationErrorCode =
  | "restore_settlement_building_input_invalid"
  | "restore_settlement_building_not_authorized"
  | "restore_settlement_building_not_found";

export type RestoreSettlementBuildingMutationIssue = MutationIssue;

export const {
  ErrorClass: RestoreSettlementBuildingMutationError,
  isError: isRestoreSettlementBuildingMutationError,
} = createMutationError<RestoreSettlementBuildingMutationErrorCode>(
  "RestoreSettlementBuildingMutationError",
);
export type RestoreSettlementBuildingMutationError = InstanceType<
  typeof RestoreSettlementBuildingMutationError
>;

type HardDeleteSettlementBuildingMutationErrorCode =
  | "hard_delete_settlement_building_input_invalid"
  | "hard_delete_settlement_building_not_authorized"
  | "hard_delete_settlement_building_not_found"
  | "hard_delete_settlement_building_wrong_state";

export type HardDeleteSettlementBuildingMutationIssue = MutationIssue;

export const {
  ErrorClass: HardDeleteSettlementBuildingMutationError,
  isError: isHardDeleteSettlementBuildingMutationError,
} = createMutationError<HardDeleteSettlementBuildingMutationErrorCode>(
  "HardDeleteSettlementBuildingMutationError",
);
export type HardDeleteSettlementBuildingMutationError = InstanceType<
  typeof HardDeleteSettlementBuildingMutationError
>;

type ManualDeconstructBuildingMutationOptions = UseMutationOptions<
  ManualDeconstructBuildingResult,
  Error,
  ManualDeconstructBuildingInput
>;

export function manualDeconstructBuildingMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): ManualDeconstructBuildingMutationOptions {
  return mutationOptions({
    mutationFn: (input: ManualDeconstructBuildingInput) =>
      manualDeconstructBuilding(client, input),
    mutationKey: [...buildingsQueryKeys.all, "manual-deconstruct-building"],
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            buildingsQueryKeys.settlementBuildingsBySettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.settlementPopulationCap(settlementId),
        }),
      ]);
    },
  });
}

async function manualDeconstructBuilding(
  client: GubernatorSupabaseClient,
  input: ManualDeconstructBuildingInput,
): Promise<ManualDeconstructBuildingResult> {
  const values = parseInput(manualDeconstructBuildingInputSchema, input);

  const { data, error } = await client
    .rpc("manual_deconstruct_settlement_building", {
      p_settlement_building_id: values.settlementBuildingId,
    })
    .maybeSingle<{ readonly settlement_building_id: string }>();

  if (error !== null) {
    if (error.code === "42501") {
      throw new ManualDeconstructBuildingMutationError({
        code: "manual_deconstruct_building_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0002") {
      throw new ManualDeconstructBuildingMutationError({
        code: "manual_deconstruct_building_not_found",
        message: "Settlement building not found.",
      });
    }
    if (error.code === "P0001") {
      throw new ManualDeconstructBuildingMutationError({
        code: "manual_deconstruct_building_wrong_state",
        message: "Building cannot be deconstructed in its current state.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new ManualDeconstructBuildingMutationError({
      code: "manual_deconstruct_building_not_found",
      message: "Settlement building not found.",
    });
  }

  return { settlementBuildingId: data.settlement_building_id };
}

export function restoreSettlementBuildingMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): UseMutationOptions<
  RestoreSettlementBuildingResult,
  Error,
  RestoreSettlementBuildingInput
> {
  return mutationOptions({
    mutationFn: (input: RestoreSettlementBuildingInput) =>
      restoreSettlementBuilding(client, input),
    mutationKey: [...buildingsQueryKeys.all, "restore-settlement-building"],
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            buildingsQueryKeys.settlementBuildingsBySettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.settlementPopulationCap(settlementId),
        }),
      ]);
    },
  });
}

async function restoreSettlementBuilding(
  client: GubernatorSupabaseClient,
  input: RestoreSettlementBuildingInput,
): Promise<RestoreSettlementBuildingResult> {
  const values = parseRestoreInput(restoreSettlementBuildingInputSchema, input);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  const rpcCall = (client as any).rpc("restore_settlement_building", {
    p_building_id: values.settlementBuildingId,
    p_world_id: values.worldId,
  });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const result = await rpcCall.maybeSingle();

  const { data, error } = result as {
    data: { readonly id: string } | null;
    error: { code?: string; message?: string } | null;
  };

  if (error !== null) {
    if (error.code === "42501") {
      throw new RestoreSettlementBuildingMutationError({
        code: "restore_settlement_building_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new RestoreSettlementBuildingMutationError({
      code: "restore_settlement_building_not_found",
      message: "Settlement building not found or cannot be restored.",
    });
  }

  return { settlementBuildingId: data.id, worldId: values.worldId };
}

export function hardDeleteSettlementBuildingMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
}): UseMutationOptions<
  HardDeleteSettlementBuildingResult,
  Error,
  HardDeleteSettlementBuildingInput
> {
  return mutationOptions({
    mutationFn: (input: HardDeleteSettlementBuildingInput) =>
      hardDeleteSettlementBuilding(client, input),
    mutationKey: [...buildingsQueryKeys.all, "hard-delete-settlement-building"],
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            buildingsQueryKeys.settlementBuildingsBySettlement(settlementId),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.settlementPopulationCap(settlementId),
        }),
      ]);
    },
  });
}

async function hardDeleteSettlementBuilding(
  client: GubernatorSupabaseClient,
  input: HardDeleteSettlementBuildingInput,
): Promise<HardDeleteSettlementBuildingResult> {
  const values = parseHardDeleteInput(
    hardDeleteSettlementBuildingInputSchema,
    input,
  );

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  const rpcCall = (client as any).rpc("hard_delete_settlement_building", {
    p_building_id: values.settlementBuildingId,
    p_world_id: values.worldId,
  });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
  const result = await rpcCall.maybeSingle();

  const { data, error } = result as {
    data: { readonly id: string; readonly world_id: string } | null;
    error: { code?: string; message?: string } | null;
  };

  if (error !== null) {
    if (error.code === "42501") {
      throw new HardDeleteSettlementBuildingMutationError({
        code: "hard_delete_settlement_building_not_authorized",
        message: "Insufficient privileges.",
      });
    }
    if (error.code === "P0001") {
      throw new HardDeleteSettlementBuildingMutationError({
        code: "hard_delete_settlement_building_wrong_state",
        message:
          "Building must be deconstructed before it can be permanently deleted.",
      });
    }
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new HardDeleteSettlementBuildingMutationError({
      code: "hard_delete_settlement_building_not_found",
      message: "Settlement building not found.",
    });
  }

  return { settlementBuildingId: data.id, worldId: data.world_id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new ManualDeconstructBuildingMutationError({
        code: "manual_deconstruct_building_input_invalid",
        issues,
        message: "Manual deconstruct building input is invalid.",
      }),
  );
}

function parseRestoreInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new RestoreSettlementBuildingMutationError({
        code: "restore_settlement_building_input_invalid",
        issues,
        message: "Restore settlement building input is invalid.",
      }),
  );
}

function parseHardDeleteInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new HardDeleteSettlementBuildingMutationError({
        code: "hard_delete_settlement_building_input_invalid",
        issues,
        message: "Hard delete settlement building input is invalid.",
      }),
  );
}
