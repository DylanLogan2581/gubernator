import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { citizensQueryKeys } from "./citizensQueryKeys";

export type CitizenMemory = {
  readonly citizenId: string;
  readonly createdAt: string;
  readonly eventId: string | null;
  readonly id: string;
  readonly memoryText: string;
  readonly occurredOnTurnNumber: number;
  readonly source: string;
  readonly worldId: string;
};

type CitizenMemoriesQueryKey = ReturnType<typeof citizensQueryKeys.memories>;

export type CitizenMemoriesQueryOptions = UseQueryOptions<
  readonly CitizenMemory[],
  Error,
  readonly CitizenMemory[],
  CitizenMemoriesQueryKey
>;

function toMemory(row: {
  readonly citizen_id: string;
  readonly created_at: string;
  readonly event_id: string | null;
  readonly id: string;
  readonly memory_text: string;
  readonly occurred_on_turn_number: number;
  readonly source: string;
  readonly world_id: string;
}): CitizenMemory {
  return {
    citizenId: row.citizen_id,
    createdAt: row.created_at,
    eventId: row.event_id,
    id: row.id,
    memoryText: row.memory_text,
    occurredOnTurnNumber: row.occurred_on_turn_number,
    source: row.source,
    worldId: row.world_id,
  };
}

async function getCitizenMemories(
  client: GubernatorSupabaseClient,
  citizenId: string,
): Promise<readonly CitizenMemory[]> {
  const { data, error } = await client
    .from("citizen_memories")
    .select(
      "id, citizen_id, world_id, memory_text, occurred_on_turn_number, source, event_id, created_at",
    )
    .eq("citizen_id", citizenId)
    .order("occurred_on_turn_number", { ascending: false })
    .order("created_at", { ascending: false });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toMemory);
}

export function citizenMemoriesQueryOptions(
  citizenId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CitizenMemoriesQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCitizenMemories(client, citizenId),
    queryKey: citizensQueryKeys.memories(citizenId),
  });
}
