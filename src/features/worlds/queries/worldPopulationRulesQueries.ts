import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import {
  worldPopulationRulesSchema,
  type WorldPopulationRules,
} from "../schemas/worldPopulationRulesSchemas";

import { worldQueryKeys } from "./worldQueryKeys";

type WorldPopulationRulesQueryKey = ReturnType<
  typeof worldQueryKeys.populationRules
>;
type WorldPopulationRulesQueryOptions = UseQueryOptions<
  WorldPopulationRules,
  AuthUiError | WorldPopulationRulesError,
  WorldPopulationRules,
  WorldPopulationRulesQueryKey
>;
type WorldPopulationRulesErrorCode =
  | "world_population_rules_invalid"
  | "world_population_rules_missing";

const WORLD_POPULATION_RULES_SELECT =
  "fertility_chance,food_consumption_per_citizen,homelessness_decline_rate,incest_prevention_depth,maximum_fertility_age_turns,minimum_partnership_age_turns,mourning_period_turns,partnership_seek_chance,starvation_severity_multiplier,water_consumption_per_citizen";

export class WorldPopulationRulesError extends Error {
  readonly code: WorldPopulationRulesErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: WorldPopulationRulesErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "WorldPopulationRulesError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function worldPopulationRulesQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldPopulationRulesQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldPopulationRules(client, worldId),
    queryKey: worldQueryKeys.populationRules(worldId),
    retry: shouldRetryWorldPopulationRulesQuery,
  });
}

export function shouldRetryWorldPopulationRulesQuery(
  failureCount: number,
  error: Error,
): boolean {
  return failureCount < 3 && !isWorldPopulationRulesError(error);
}

export function isWorldPopulationRulesError(
  error: unknown,
): error is WorldPopulationRulesError {
  return error instanceof WorldPopulationRulesError;
}

async function getWorldPopulationRules(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldPopulationRules> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_POPULATION_RULES_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new WorldPopulationRulesError({
      code: "world_population_rules_missing",
      message: "Population rules are unavailable.",
      worldId,
    });
  }

  const parseResult = worldPopulationRulesSchema.safeParse(data);

  if (!parseResult.success) {
    throw new WorldPopulationRulesError({
      code: "world_population_rules_invalid",
      message: "Population rules are invalid.",
      worldId,
    });
  }

  return parseResult.data;
}
