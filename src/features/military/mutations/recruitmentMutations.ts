import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { citizensQueryKeys } from "@/features/citizens";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { armiesQueryKeys } from "../queries/armiesQueryKeys";
import { toUnitSoldier } from "../queries/armyRows";
import {
  dischargeSoldiersInputSchema,
  recruitSoldiersInputSchema,
  type DischargeSoldiersInput,
  type RecruitSoldiersInput,
} from "../schemas/recruitmentSchemas";

import type { UnitSoldier } from "../types/armyTypes";
import type { z } from "zod";

type RecruitmentMutationErrorCode =
  | "recruitment_building_requirement_not_met"
  | "recruitment_forbidden"
  | "recruitment_input_invalid"
  | "recruitment_not_found"
  | "recruitment_rejected"
  | "recruitment_unit_capacity_exceeded"
  | "world_archived";

export type RecruitmentMutationIssue = MutationIssue;

export const {
  ErrorClass: RecruitmentMutationError,
  isError: isRecruitmentMutationError,
} = createMutationError<RecruitmentMutationErrorCode>(
  "RecruitmentMutationError",
);
export type RecruitmentMutationError = InstanceType<
  typeof RecruitmentMutationError
>;

export type DischargeSoldiersResult = {
  readonly citizenIds: readonly string[];
};

function invalidateAfterRosterChange(
  queryClient: QueryClient,
  {
    settlementId,
    unitId,
  }: { readonly settlementId: string; readonly unitId: string },
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: armiesQueryKeys.soldiersByUnit(unitId),
    }),
    // Broad invalidation of the rest of the military feature (soldier
    // counts/latest snapshots are keyed by army-id arrays we don't have a
    // handle on here) -- cheap relative to a recruit/discharge action.
    queryClient.invalidateQueries({ queryKey: armiesQueryKeys.all }),
    queryClient.invalidateQueries({
      queryKey: citizensQueryKeys.assignmentsInSettlement(settlementId),
    }),
    queryClient.invalidateQueries({
      queryKey: citizensQueryKeys.settlementTargetAssignments(settlementId),
    }),
  ]).then(() => undefined);
}

type RecruitSoldiersMutationOptions = UseMutationOptions<
  readonly UnitSoldier[],
  AuthUiError | RecruitmentMutationError,
  RecruitSoldiersInput
>;

export function recruitSoldiersMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RecruitSoldiersMutationOptions {
  return mutationOptions({
    mutationFn: (input: RecruitSoldiersInput) => recruitSoldiers(client, input),
    mutationKey: [...armiesQueryKeys.all, "recruit-soldiers"],
    onSuccess: async (_result, input): Promise<void> => {
      const values = parseRecruitInput(input);
      await invalidateAfterRosterChange(queryClient, {
        settlementId: values.settlementId,
        unitId: values.unitId,
      });
    },
  });
}

function parseRecruitInput(
  input: unknown,
): z.output<typeof recruitSoldiersInputSchema> {
  return parseMutationInput(
    recruitSoldiersInputSchema,
    input,
    (issues) =>
      new RecruitmentMutationError({
        code: "recruitment_input_invalid",
        issues,
        message: "Recruitment input is invalid.",
      }),
  );
}

async function recruitSoldiers(
  client: GubernatorSupabaseClient,
  input: RecruitSoldiersInput,
): Promise<readonly UnitSoldier[]> {
  const values = parseRecruitInput(input);

  const { data, error } = await client.rpc("recruit_soldiers", {
    p_citizen_ids: values.citizenIds,
    p_settlement_id: values.settlementId,
    p_unit_id: values.unitId,
  });

  if (error !== null) {
    throw translateRecruitmentError(error);
  }

  return data.map(toUnitSoldier);
}

type DischargeSoldiersMutationOptions = UseMutationOptions<
  DischargeSoldiersResult,
  AuthUiError | RecruitmentMutationError,
  DischargeSoldiersInput
>;

export function dischargeSoldiersMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
  settlementId,
  unitId,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly unitId: string;
}): DischargeSoldiersMutationOptions {
  return mutationOptions({
    mutationFn: (input: DischargeSoldiersInput) =>
      dischargeSoldiers(client, input),
    mutationKey: [...armiesQueryKeys.all, "discharge-soldiers"],
    onSuccess: () =>
      invalidateAfterRosterChange(queryClient, { settlementId, unitId }),
  });
}

async function dischargeSoldiers(
  client: GubernatorSupabaseClient,
  input: DischargeSoldiersInput,
): Promise<DischargeSoldiersResult> {
  const values = parseMutationInput(
    dischargeSoldiersInputSchema,
    input,
    (issues) =>
      new RecruitmentMutationError({
        code: "recruitment_input_invalid",
        issues,
        message: "Discharge input is invalid.",
      }),
  );

  const { data, error } = await client.rpc("discharge_soldiers", {
    p_soldier_ids: values.soldierIds,
  });

  if (error !== null) {
    throw translateRecruitmentError(error);
  }

  return { citizenIds: data.map((row) => row.id) };
}

function translateRecruitmentError(error: {
  readonly code?: string | null;
  readonly hint?: string | null;
  readonly message: string;
}): Error {
  if (error.code === "42501") {
    return new RecruitmentMutationError({
      code: "recruitment_forbidden",
      message: "You do not have permission to manage this nation's military.",
    });
  }
  if (error.code === "P0002") {
    return new RecruitmentMutationError({
      code: "recruitment_not_found",
      message: "Unit, settlement, or citizen not found.",
    });
  }
  if (error.hint === "world_archived") {
    return new RecruitmentMutationError({
      code: "world_archived",
      message: "This world is archived and read-only.",
    });
  }
  if (error.hint === "unit_capacity_exceeded") {
    return new RecruitmentMutationError({
      code: "recruitment_unit_capacity_exceeded",
      message: "Recruiting these citizens would exceed the unit's capacity.",
    });
  }
  if (error.hint === "building_requirement_not_met") {
    return new RecruitmentMutationError({
      code: "recruitment_building_requirement_not_met",
      message: "The settlement lacks the building required for this unit type.",
    });
  }
  if (error.code === "22023") {
    return new RecruitmentMutationError({
      code: "recruitment_rejected",
      message: error.message,
    });
  }
  return normalizeSupabaseError(error);
}
