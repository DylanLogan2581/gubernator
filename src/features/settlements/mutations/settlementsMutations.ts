import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { nationsQueryKeys } from "@/features/nations";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { settlementsQueryKeys } from "../queries/settlementsQueryKeys";
import {
  createSettlementInputSchema,
  deleteSettlementInputSchema,
  updateSettlementCoordinatesInputSchema,
  updateSettlementDetailsInputSchema,
  type CreateSettlementInput,
  type DeleteSettlementInput,
  type UpdateSettlementCoordinatesInput,
  type UpdateSettlementDetailsInput,
} from "../schemas/settlementSchemas";

import type { Settlement } from "../types/settlementTypes";
import type { z } from "zod";

type SettlementMutationErrorCode =
  | "settlement_input_invalid"
  | "settlement_not_found";

type CreateSettlementMutationOptions = UseMutationOptions<
  Settlement,
  AuthUiError | SettlementMutationError,
  CreateSettlementInput
>;
type UpdateSettlementDetailsMutationOptions = UseMutationOptions<
  Settlement,
  AuthUiError | SettlementMutationError,
  UpdateSettlementDetailsInput
>;
type UpdateSettlementCoordinatesMutationOptions = UseMutationOptions<
  Settlement,
  AuthUiError | SettlementMutationError,
  UpdateSettlementCoordinatesInput
>;
type DeleteSettlementMutationOptions = UseMutationOptions<
  DeleteSettlementResult,
  AuthUiError | SettlementMutationError,
  DeleteSettlementInput
>;

type SettlementRow = {
  readonly coord_x: number | null;
  readonly coord_z: number | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly name: string;
  readonly nation_id: string;
  readonly updated_at: string;
};

export type DeleteSettlementResult = {
  readonly nationId: string;
  readonly settlementId: string;
};

export type SettlementMutationIssue = MutationIssue;

const SETTLEMENT_SELECT =
  "id,nation_id,name,description,coord_x,coord_z,created_at,updated_at";

export const {
  ErrorClass: SettlementMutationError,
  isError: isSettlementMutationError,
} = createMutationError<SettlementMutationErrorCode>("SettlementMutationError");
export type SettlementMutationError = InstanceType<
  typeof SettlementMutationError
>;

// Planned for use in the settlement creation UI (not yet wired to a component).
export function createSettlementMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateSettlementMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateSettlementInput) =>
      createSettlement(client, input),
    mutationKey: [...settlementsQueryKeys.all, "create-settlement"],
    onSuccess: async (settlement): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.settlements(settlement.nationId),
      });
    },
  });
}

export function updateSettlementDetailsMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateSettlementDetailsMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateSettlementDetailsInput) =>
      updateSettlementDetails(client, input),
    mutationKey: [...settlementsQueryKeys.all, "update-settlement-details"],
    onSuccess: async (settlement): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: settlementsQueryKeys.detail(settlement.id),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.settlements(settlement.nationId),
        }),
      ]);
    },
  });
}

export function updateSettlementCoordinatesMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateSettlementCoordinatesMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateSettlementCoordinatesInput) =>
      updateSettlementCoordinates(client, input),
    mutationKey: [...settlementsQueryKeys.all, "update-settlement-coordinates"],
    onSuccess: async (settlement): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: settlementsQueryKeys.detail(settlement.id),
      });
    },
  });
}

export function deleteSettlementMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteSettlementMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteSettlementInput) =>
      deleteSettlement(client, input),
    mutationKey: [...settlementsQueryKeys.all, "delete-settlement"],
    onSuccess: async (result): Promise<void> => {
      queryClient.removeQueries({
        queryKey: settlementsQueryKeys.detail(result.settlementId),
      });
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.settlements(result.nationId),
      });
    },
  });
}

async function createSettlement(
  client: GubernatorSupabaseClient,
  input: CreateSettlementInput,
): Promise<Settlement> {
  const values = parseInput(createSettlementInputSchema, input);

  const { data, error } = await client
    .from("settlements")
    .insert({
      coord_x: values.coordX ?? null,
      coord_z: values.coordZ ?? null,
      description: values.description ?? null,
      name: values.name.trim(),
      nation_id: values.nationId,
    })
    .select(SETTLEMENT_SELECT)
    .maybeSingle<SettlementRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SettlementMutationError({
      code: "settlement_not_found",
      message: "Settlement could not be created.",
    });
  }

  return toSettlement(data);
}

async function updateSettlementDetails(
  client: GubernatorSupabaseClient,
  input: UpdateSettlementDetailsInput,
): Promise<Settlement> {
  const values = parseInput(updateSettlementDetailsInputSchema, input);

  const { data, error } = await client
    .from("settlements")
    .update({
      description: values.description ?? null,
      name: values.name.trim(),
    })
    .eq("id", values.settlementId)
    .eq("nation_id", values.nationId)
    .select(SETTLEMENT_SELECT)
    .single<SettlementRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SettlementMutationError({
      code: "settlement_not_found",
      message: "Settlement could not be updated.",
    });
  }

  return toSettlement(data);
}

async function updateSettlementCoordinates(
  client: GubernatorSupabaseClient,
  input: UpdateSettlementCoordinatesInput,
): Promise<Settlement> {
  const values = parseInput(updateSettlementCoordinatesInputSchema, input);

  const { data, error } = await client
    .from("settlements")
    .update({
      coord_x: values.coordX,
      coord_z: values.coordZ,
    })
    .eq("id", values.settlementId)
    .eq("nation_id", values.nationId)
    .select(SETTLEMENT_SELECT)
    .single<SettlementRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SettlementMutationError({
      code: "settlement_not_found",
      message: "Settlement coordinates could not be updated.",
    });
  }

  return toSettlement(data);
}

async function deleteSettlement(
  client: GubernatorSupabaseClient,
  input: DeleteSettlementInput,
): Promise<DeleteSettlementResult> {
  const values = parseInput(deleteSettlementInputSchema, input);

  const { data, error } = await client
    .from("settlements")
    .delete()
    .eq("id", values.settlementId)
    .eq("nation_id", values.nationId)
    .select("id,nation_id")
    .maybeSingle<{ readonly id: string; readonly nation_id: string }>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SettlementMutationError({
      code: "settlement_not_found",
      message: "Settlement could not be deleted.",
    });
  }

  return { nationId: data.nation_id, settlementId: data.id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new SettlementMutationError({
      code: "settlement_input_invalid",
      issues: result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
      message: "Settlement input is invalid.",
    });
  }

  return result.data;
}

function toSettlement(row: SettlementRow): Settlement {
  return {
    coordX: row.coord_x,
    coordZ: row.coord_z,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    name: row.name,
    nationId: row.nation_id,
    updatedAt: row.updated_at,
  };
}
