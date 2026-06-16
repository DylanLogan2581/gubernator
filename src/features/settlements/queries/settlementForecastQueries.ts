import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

// -- Public domain types --

export type SettlementForecast = {
  readonly forecastSnapshot: unknown; // Raw forecast data structure
};

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
    fetcher: (c) => getLiveWorldForecast(c, worldId),
    queryKey: ["forecast", "world", worldId] as const,
  });
}

// -- Fetchers --

// Runs the turn engine as a read-only dry-run and returns the forecast it
// would produce if the turn were ended right now — so it reflects current
// events, assignments, trade routes, and stockpiles. Nothing is persisted.
async function getLiveWorldForecast(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<SettlementForecast | null> {
  const response = await client.functions.invoke<unknown>(
    "end-turn-simulation",
    {
      // expectedTurnNumber is unused on the preview path (no stale-turn gate);
      // preview tells the function to dry-run instead of advancing the turn.
      body: { expectedTurnNumber: 0, preview: true, worldId },
    },
  );

  if (response.error !== null) {
    throw normalizeSupabaseError(response.error);
  }

  if (!isForecastSuccessResponse(response.data)) {
    return null;
  }

  return { forecastSnapshot: response.data.data.forecastSnapshot };
}

type ForecastSuccessResponse = {
  readonly data: { readonly forecastSnapshot: unknown };
  readonly ok: true;
};

function isForecastSuccessResponse(
  value: unknown,
): value is ForecastSuccessResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as Record<string, unknown>).ok === true &&
    "data" in value &&
    typeof (value as Record<string, unknown>).data === "object" &&
    (value as Record<string, unknown>).data !== null &&
    "forecastSnapshot" in
      ((value as Record<string, unknown>).data as Record<string, unknown>)
  );
}
