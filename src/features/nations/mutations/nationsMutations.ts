import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { culturesQueryKeys } from "@/features/cultures";
import { religionsQueryKeys } from "@/features/religions";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "../queries/nationsQueryKeys";
import {
  createNationInputSchema,
  deleteNationInputSchema,
  setNationCapitalAndFoundedTurnInputSchema,
  setNationCultureReligionInputSchema,
  setNationGovernmentTypeInputSchema,
  setNationTradePolicyInputSchema,
  updateNationDetailsInputSchema,
  type CreateNationInput,
  type DeleteNationInput,
  type SetNationCapitalAndFoundedTurnInput,
  type SetNationCultureReligionInput,
  type SetNationGovernmentTypeInput,
  type SetNationTradePolicyInput,
  type UpdateNationDetailsInput,
} from "../schemas/nationSchemas";

import type {
  Nation,
  NationGovernmentType,
  NationTradePolicy,
} from "../types/nationTypes";
import type { z } from "zod";

type NationMutationErrorCode = "nation_input_invalid" | "nation_not_found";
type CreateNationMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  CreateNationInput
>;
type UpdateNationDetailsMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  UpdateNationDetailsInput
>;
type SetNationGovernmentTypeMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  SetNationGovernmentTypeInput
>;
type SetNationTradePolicyMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  SetNationTradePolicyInput
>;
type SetNationCapitalAndFoundedTurnMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  SetNationCapitalAndFoundedTurnInput
>;
type SetNationCultureReligionMutationOptions = UseMutationOptions<
  Nation,
  AuthUiError | NationMutationError,
  SetNationCultureReligionInput
>;
type DeleteNationMutationOptions = UseMutationOptions<
  DeleteNationResult,
  AuthUiError | NationMutationError,
  DeleteNationInput
>;

type NationRow = {
  readonly capital_settlement_id: string | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly flag_path: string | null;
  readonly founded_turn_number: number | null;
  readonly government_type: string;
  readonly id: string;
  readonly name: string;
  readonly nameset_id: string | null;
  readonly primary_culture_id: string | null;
  readonly state_religion_id: string | null;
  readonly tax_rate: number;
  readonly trade_policy: string;
  readonly updated_at: string;
  readonly world_id: string;
};

export type DeleteNationResult = {
  readonly nationId: string;
  readonly worldId: string;
};

const NATION_SELECT =
  "id,world_id,name,description,nameset_id,capital_settlement_id,founded_turn_number,government_type,flag_path,tax_rate,trade_policy,primary_culture_id,state_religion_id,created_at,updated_at";

export type NationMutationIssue = MutationIssue;

export const {
  ErrorClass: NationMutationError,
  isError: isNationMutationError,
} = createMutationError<NationMutationErrorCode>("NationMutationError");
export type NationMutationError = InstanceType<typeof NationMutationError>;

export function createNationMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateNationMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateNationInput) => createNation(client, input),
    mutationKey: [...nationsQueryKeys.all, "create-nation"],
    onSuccess: async (nation): Promise<void> => {
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.list(nation.worldId),
      });
    },
  });
}

export function updateNationDetailsMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): UpdateNationDetailsMutationOptions {
  return mutationOptions({
    mutationFn: (input: UpdateNationDetailsInput) =>
      updateNationDetails(client, input),
    mutationKey: [...nationsQueryKeys.all, "update-nation-details"],
    onSuccess: async (nation): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(nation.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(nation.id),
        }),
      ]);
    },
  });
}

export function setNationGovernmentTypeMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNationGovernmentTypeMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationGovernmentTypeInput) =>
      setNationGovernmentType(client, input),
    mutationKey: [...nationsQueryKeys.all, "set-nation-government-type"],
    onSuccess: async (nation): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(nation.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(nation.id),
        }),
      ]);
    },
  });
}

export function setNationTradePolicyMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNationTradePolicyMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationTradePolicyInput) =>
      setNationTradePolicy(client, input),
    mutationKey: [...nationsQueryKeys.all, "set-nation-trade-policy"],
    onSuccess: async (nation): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(nation.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(nation.id),
        }),
      ]);
    },
  });
}

export function setNationCultureReligionMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNationCultureReligionMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationCultureReligionInput) =>
      setNationCultureReligion(client, input),
    mutationKey: [...nationsQueryKeys.all, "set-nation-culture-religion"],
    onSuccess: async (nation): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(nation.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(nation.id),
        }),
        queryClient.invalidateQueries({
          queryKey: [...culturesQueryKeys.all, "usage"],
        }),
        queryClient.invalidateQueries({
          queryKey: [...religionsQueryKeys.all, "usage"],
        }),
      ]);
    },
  });
}

export function setNationCapitalAndFoundedTurnMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SetNationCapitalAndFoundedTurnMutationOptions {
  return mutationOptions({
    mutationFn: (input: SetNationCapitalAndFoundedTurnInput) =>
      setNationCapitalAndFoundedTurn(client, input),
    mutationKey: [
      ...nationsQueryKeys.all,
      "set-nation-capital-and-founded-turn",
    ],
    onSuccess: async (nation): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.list(nation.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationsQueryKeys.detail(nation.id),
        }),
      ]);
    },
  });
}

export function deleteNationMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): DeleteNationMutationOptions {
  return mutationOptions({
    mutationFn: (input: DeleteNationInput) => deleteNation(client, input),
    mutationKey: [...nationsQueryKeys.all, "delete-nation"],
    onSuccess: async (result): Promise<void> => {
      queryClient.removeQueries({
        queryKey: nationsQueryKeys.detail(result.nationId),
      });
      queryClient.removeQueries({
        queryKey: nationsQueryKeys.settlements(result.nationId),
      });
      await queryClient.invalidateQueries({
        queryKey: nationsQueryKeys.list(result.worldId),
      });
    },
  });
}

async function createNation(
  client: GubernatorSupabaseClient,
  input: CreateNationInput,
): Promise<Nation> {
  const values = parseInput(createNationInputSchema, input);

  const { data, error } = await client
    .from("nations")
    .insert({
      description: values.description ?? null,
      ...(values.governmentType === undefined
        ? {}
        : { government_type: values.governmentType }),
      name: values.name.trim(),
      world_id: values.worldId,
    })
    .select(NATION_SELECT)
    .maybeSingle<NationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation could not be created.",
    });
  }

  // founded_turn_number is not directly insertable (grant insert list omits
  // it, mirroring capital_settlement_id — see
  // restrict_child_domain_writes/add_nation_capital_and_founded_turn), so it
  // is set via the same RPC the Identity card edit control uses, right after
  // the row exists.
  if (
    values.foundedTurnNumber !== undefined &&
    values.foundedTurnNumber !== null
  ) {
    return setNationCapitalAndFoundedTurn(client, {
      capitalSettlementId: null,
      foundedTurnNumber: values.foundedTurnNumber,
      nationId: data.id,
      worldId: data.world_id,
    });
  }

  return toNation(data);
}

async function updateNationDetails(
  client: GubernatorSupabaseClient,
  input: UpdateNationDetailsInput,
): Promise<Nation> {
  const values = parseInput(updateNationDetailsInputSchema, input);

  const { data, error } = await client
    .from("nations")
    .update({
      description: values.description ?? null,
      name: values.name.trim(),
    })
    .eq("id", values.nationId)
    .eq("world_id", values.worldId)
    .select(NATION_SELECT)
    .maybeSingle<NationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation could not be updated.",
    });
  }

  return toNation(data);
}

async function setNationGovernmentType(
  client: GubernatorSupabaseClient,
  input: SetNationGovernmentTypeInput,
): Promise<Nation> {
  const values = parseInput(setNationGovernmentTypeInputSchema, input);

  const { data, error } = await client
    .from("nations")
    .update({ government_type: values.governmentType })
    .eq("id", values.nationId)
    .eq("world_id", values.worldId)
    .select(NATION_SELECT)
    .maybeSingle<NationRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation government type could not be updated.",
    });
  }

  return toNation(data);
}

async function setNationTradePolicy(
  client: GubernatorSupabaseClient,
  input: SetNationTradePolicyInput,
): Promise<Nation> {
  const values = parseInput(setNationTradePolicyInputSchema, input);

  // set_nation_trade_policy is a SECURITY DEFINER RPC (nation managers can't
  // write the nations table directly — see
  // 20260912000000_add_nation_trade_policy). Called via the same untyped-rpc
  // cast as setNationCapitalAndFoundedTurn above.
  const clientAsRpcCapable = client as unknown as {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): {
      maybeSingle(): Promise<{ data: unknown; error: unknown }>;
    };
  };

  const { data, error } = await clientAsRpcCapable
    .rpc("set_nation_trade_policy", {
      p_nation_id: values.nationId,
      p_trade_policy: values.tradePolicy,
    })
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation trade policy could not be updated.",
    });
  }

  return toNation(data as NationRow);
}

async function setNationCultureReligion(
  client: GubernatorSupabaseClient,
  input: SetNationCultureReligionInput,
): Promise<Nation> {
  const values = parseInput(setNationCultureReligionInputSchema, input);

  // set_nation_culture_religion is a SECURITY DEFINER RPC (same authority
  // model as set_nation_trade_policy — see
  // 20260919000000_add_cultures_and_religions). Called via the same
  // untyped-rpc cast as setNationTradePolicy above.
  const clientAsRpcCapable = client as unknown as {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): {
      maybeSingle(): Promise<{ data: unknown; error: unknown }>;
    };
  };

  const { data, error } = await clientAsRpcCapable
    .rpc("set_nation_culture_religion", {
      p_nation_id: values.nationId,
      p_primary_culture_id: values.primaryCultureId,
      p_state_religion_id: values.stateReligionId,
    })
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation culture and religion could not be updated.",
    });
  }

  return toNation(data as NationRow);
}

async function setNationCapitalAndFoundedTurn(
  client: GubernatorSupabaseClient,
  input: SetNationCapitalAndFoundedTurnInput,
): Promise<Nation> {
  const values = parseInput(setNationCapitalAndFoundedTurnInputSchema, input);

  // The RPC function accepts a nullable capital settlement id and founded
  // turn number; TypeScript's generated types don't reflect this, so we call
  // the RPC directly on the client object (mirrors updateSettlementCoordinates
  // in src/features/settlements/mutations/settlementsMutations.ts).
  const clientAsRpcCapable = client as unknown as {
    rpc(
      name: string,
      params: Record<string, unknown>,
    ): {
      maybeSingle(): Promise<{ data: unknown; error: unknown }>;
    };
  };

  const { data, error } = await clientAsRpcCapable
    .rpc("set_nation_capital_and_founded_turn", {
      p_capital_settlement_id: values.capitalSettlementId,
      p_founded_turn_number: values.foundedTurnNumber,
      p_nation_id: values.nationId,
    })
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation capital and founded turn could not be updated.",
    });
  }

  return toNation(data as NationRow);
}

async function deleteNation(
  client: GubernatorSupabaseClient,
  input: DeleteNationInput,
): Promise<DeleteNationResult> {
  const values = parseInput(deleteNationInputSchema, input);

  const { data, error } = await client
    .from("nations")
    .delete()
    .eq("id", values.nationId)
    .eq("world_id", values.worldId)
    .select("id,world_id")
    .maybeSingle<{ readonly id: string; readonly world_id: string }>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new NationMutationError({
      code: "nation_not_found",
      message: "Nation could not be deleted.",
    });
  }

  return { nationId: data.id, worldId: data.world_id };
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new NationMutationError({
        code: "nation_input_invalid",
        issues,
        message: "Nation input is invalid.",
      }),
  );
}

function toNation(row: NationRow): Nation {
  return {
    capitalSettlementId: row.capital_settlement_id,
    createdAt: row.created_at,
    description: row.description,
    flagPath: row.flag_path,
    foundedTurnNumber: row.founded_turn_number,
    governmentType: row.government_type as NationGovernmentType,
    id: row.id,
    name: row.name,
    namesetId: row.nameset_id,
    primaryCultureId: row.primary_culture_id,
    stateReligionId: row.state_religion_id,
    taxRate: row.tax_rate,
    tradePolicy: row.trade_policy as NationTradePolicy,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
