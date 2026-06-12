import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

// -- Private row types --

type TurnTransitionRow = {
  readonly forecast_snapshot_jsonb: unknown;
  readonly id: string;
};

// -- Public domain types --

export type SettlementForecast = {
  readonly forecastSnapshot: unknown; // Raw forecast data structure
  readonly transitionId: string;
};

// -- Select columns --

const FORECAST_SELECT = ["id", "forecast_snapshot_jsonb"].join(",");

// -- Query option types --

type SettlementForecastQueryKey = readonly ["forecast", "world", string];

// -- Query options --

export function settlementForecastQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  SettlementForecast | null,
  Error,
  SettlementForecast | null,
  SettlementForecastQueryKey
> {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getLatestWorldForecast(c, worldId),
    queryKey: ["forecast", "world", worldId] as const,
  });
}

// -- Fetchers --

async function getLatestWorldForecast(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<SettlementForecast | null> {
  // Get the latest turn transition that has a forecast for this world
  const { data, error } = await client
    .from("turn_transitions")
    .select(FORECAST_SELECT)
    .eq("world_id", worldId)
    .neq("forecast_snapshot_jsonb", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .returns<TurnTransitionRow[]>()
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    return null;
  }

  return {
    forecastSnapshot: data.forecast_snapshot_jsonb,
    transitionId: data.id,
  };
}
