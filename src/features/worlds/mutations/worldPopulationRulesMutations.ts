import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { toWorldAccessTarget } from "@/features/permissions";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { worldQueryKeys } from "../queries/worldQueryKeys";
import {
  worldPopulationRulesSchema,
  type WorldPopulationRules,
} from "../schemas/worldPopulationRulesSchemas";

import type { WorldPermissionContext } from "../types/worldTypes";

type SaveWorldPopulationRulesErrorCode =
  | "world_population_rules_archived"
  | "world_population_rules_invalid"
  | "world_population_rules_unauthorized";
type SaveWorldPopulationRulesMutationOptions = UseMutationOptions<
  WorldPopulationRules,
  AuthUiError | SaveWorldPopulationRulesError,
  SaveWorldPopulationRulesInput
>;
type WorldPopulationRulesSaveAccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly owner_id: string;
  readonly status: string;
  readonly visibility: string;
};

export type SaveWorldPopulationRulesInput = {
  readonly rules: unknown;
  readonly worldId: string;
};

const WORLD_POPULATION_RULES_SAVE_ACCESS_SELECT =
  "archived_at,id,owner_id,status,visibility";
const WORLD_POPULATION_RULES_SAVE_UPDATE_SELECT = "id";

export class SaveWorldPopulationRulesError extends Error {
  readonly code: SaveWorldPopulationRulesErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: SaveWorldPopulationRulesErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "SaveWorldPopulationRulesError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function saveWorldPopulationRulesMutationOptions({
  accessContext,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SaveWorldPopulationRulesMutationOptions {
  return mutationOptions({
    mutationFn: (input: SaveWorldPopulationRulesInput) =>
      saveWorldPopulationRules(client, accessContext, input),
    mutationKey: [...worldQueryKeys.all, "save-world-population-rules"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: worldQueryKeys.all });
    },
  });
}

export function isSaveWorldPopulationRulesError(
  error: unknown,
): error is SaveWorldPopulationRulesError {
  return error instanceof SaveWorldPopulationRulesError;
}

async function saveWorldPopulationRules(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  input: SaveWorldPopulationRulesInput,
): Promise<WorldPopulationRules> {
  const parseResult = worldPopulationRulesSchema.safeParse(input.rules);

  if (!parseResult.success) {
    throw new SaveWorldPopulationRulesError({
      code: "world_population_rules_invalid",
      message: "Population rules are invalid.",
      worldId: input.worldId,
    });
  }

  const world = await getPopulationRulesSaveAccessRow(client, input.worldId);

  if (
    world === null ||
    !accessContext.canAdminWorld(toWorldAccessTarget(world))
  ) {
    throw new SaveWorldPopulationRulesError({
      code: "world_population_rules_unauthorized",
      message: "You do not have permission to update population rules.",
      worldId: input.worldId,
    });
  }

  if (world.status === "archived" || world.archived_at !== null) {
    throw new SaveWorldPopulationRulesError({
      code: "world_population_rules_archived",
      message: "Archived worlds are read-only.",
      worldId: input.worldId,
    });
  }

  const rules = parseResult.data;

  const { data, error } = await client
    .from("worlds")
    .update({
      fertility_chance: rules.fertility_chance,
      food_consumption_per_citizen: rules.food_consumption_per_citizen,
      homelessness_decline_rate: rules.homelessness_decline_rate,
      incest_prevention_depth: rules.incest_prevention_depth,
      maximum_fertility_age_turns: rules.maximum_fertility_age_turns,
      minimum_partnership_age_turns: rules.minimum_partnership_age_turns,
      mourning_period_turns: rules.mourning_period_turns,
      partnership_seek_chance: rules.partnership_seek_chance,
      starvation_severity_multiplier: rules.starvation_severity_multiplier,
      water_consumption_per_citizen: rules.water_consumption_per_citizen,
    })
    .eq("id", input.worldId)
    .eq("status", "active")
    .select(WORLD_POPULATION_RULES_SAVE_UPDATE_SELECT)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SaveWorldPopulationRulesError({
      code: "world_population_rules_unauthorized",
      message: "Population rules could not be saved.",
      worldId: input.worldId,
    });
  }

  return rules;
}

async function getPopulationRulesSaveAccessRow(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldPopulationRulesSaveAccessRow | null> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_POPULATION_RULES_SAVE_ACCESS_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}
