import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { buildingsQueryKeys } from "@/features/buildings";
import { resourcesQueryKeys } from "@/features/resources";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "../queries/nationsQueryKeys";
import {
  grantNationResourcesInputSchema,
  setNationTaxRateInputSchema,
  subsidizeConstructionProjectInputSchema,
  type GrantNationResourcesInput,
  type SetNationTaxRateInput,
  type SubsidizeConstructionProjectInput,
} from "../schemas/treasurySchemas";

import type { z } from "zod";

export type { GrantNationResourcesInput };
export type { SetNationTaxRateInput };
export type { SubsidizeConstructionProjectInput };

export type GrantNationResourcesResult = {
  readonly clamped: boolean;
  readonly grantedQuantity: number;
};

export type SubsidizeConstructionProjectLineResult = {
  readonly clamped: boolean;
  readonly grantedQuantity: number;
  readonly resourceId: string;
};

type TreasuryMutationErrorCode = "treasury_input_invalid";

export type TreasuryMutationIssue = MutationIssue;

export const {
  ErrorClass: TreasuryMutationError,
  isError: isTreasuryMutationError,
} = createMutationError<TreasuryMutationErrorCode>("TreasuryMutationError");
export type TreasuryMutationError = InstanceType<typeof TreasuryMutationError>;

export type GrantNationResourcesMutationOptions = UseMutationOptions<
  GrantNationResourcesResult,
  AuthUiError | TreasuryMutationError,
  GrantNationResourcesInput
>;
export type SubsidizeConstructionProjectMutationOptions = UseMutationOptions<
  readonly SubsidizeConstructionProjectLineResult[],
  AuthUiError | TreasuryMutationError,
  SubsidizeConstructionProjectInput
>;
export type SetNationTaxRateMutationOptions = UseMutationOptions<
  void,
  AuthUiError | TreasuryMutationError,
  SetNationTaxRateInput
>;

export function grantNationResourcesMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): GrantNationResourcesMutationOptions {
  return mutationOptions({
    mutationFn: (input: GrantNationResourcesInput) =>
      grantNationResources(client, input),
    mutationKey: [...nationsQueryKeys.all, "grant-nation-resources"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.treasuryStockpile(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.stockpilesBySettlement(
            input.settlementId,
          ),
        }),
      ]);
    },
  });
}

export function subsidizeConstructionProjectMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SubsidizeConstructionProjectMutationOptions {
  return mutationOptions({
    mutationFn: (input: SubsidizeConstructionProjectInput) =>
      subsidizeConstructionProject(client, input),
    mutationKey: [...nationsQueryKeys.all, "subsidize-construction-project"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.treasuryStockpile(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.treasuryActiveProjects(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.treasuryActiveSubsidies(input.nationId),
        }),
        queryClient.invalidateQueries({
          queryKey: resourcesQueryKeys.stockpilesBySettlement(
            input.settlementId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: buildingsQueryKeys.constructionProjectsBySettlement(
            input.settlementId,
          ),
        }),
      ]);
    },
  });
}

export function setNationTaxRateMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNationTaxRateMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationTaxRateInput) =>
      setNationTaxRate(client, input),
    mutationKey: [...nationsQueryKeys.all, "set-nation-tax-rate"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(input.nationId),
        }),
      ]);
    },
  });
}

type GrantNationResourcesRow = {
  readonly clamped: boolean;
  readonly granted_quantity: number;
};

async function grantNationResources(
  client: GubernatorSupabaseClient,
  input: GrantNationResourcesInput,
): Promise<GrantNationResourcesResult> {
  // grant_nation_resources returns a bare `record` (via OUT params, not a
  // named composite/table type), which supabase-gen-types cannot introspect
  // precisely — it falls back to Record<string, unknown>, so the RPC call is
  // cast the same way setNationCapitalAndFoundedTurn casts
  // set_nation_capital_and_founded_turn in nationsMutations.ts.
  const values = parseInput(grantNationResourcesInputSchema, input);

  const clientAsRpcCapable = client as unknown as {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): {
      single(): Promise<{ data: GrantNationResourcesRow; error: unknown }>;
    };
  };

  const { data, error } = await clientAsRpcCapable
    .rpc("grant_nation_resources", {
      p_nation_id: values.nationId,
      p_quantity: values.quantity,
      p_resource_id: values.resourceId,
      p_settlement_id: values.settlementId,
    })
    .single();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return {
    clamped: data.clamped,
    grantedQuantity: data.granted_quantity,
  };
}

async function subsidizeConstructionProject(
  client: GubernatorSupabaseClient,
  input: SubsidizeConstructionProjectInput,
): Promise<readonly SubsidizeConstructionProjectLineResult[]> {
  const values = parseInput(subsidizeConstructionProjectInputSchema, input);

  const { data, error } = await client.rpc("subsidize_construction_project", {
    p_nation_id: values.nationId,
    p_project_id: values.projectId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map((row) => ({
    clamped: row.clamped,
    grantedQuantity: row.granted_quantity,
    resourceId: row.resource_id,
  }));
}

async function setNationTaxRate(
  client: GubernatorSupabaseClient,
  input: SetNationTaxRateInput,
): Promise<void> {
  const values = parseInput(setNationTaxRateInputSchema, input);

  const { error } = await client
    .rpc("set_nation_tax_rate", {
      p_nation_id: values.nationId,
      p_rate: values.rate,
    })
    .single();

  if (error !== null) {
    throw normalizeSupabaseError(error);
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
      new TreasuryMutationError({
        code: "treasury_input_invalid",
        issues,
        message: "Treasury input is invalid.",
      }),
  );
}
