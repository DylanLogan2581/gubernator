import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationReadinessQueryKeys } from "./nationReadinessQueryKeys";

import type { NationReadinessVoter } from "../types/nationReadinessTypes";

type NationReadinessVotersQueryKey = ReturnType<
  typeof nationReadinessQueryKeys.voters
>;
type NationReadinessVotersQueryOptions = UseQueryOptions<
  readonly NationReadinessVoter[],
  AuthUiError,
  readonly NationReadinessVoter[],
  NationReadinessVotersQueryKey
>;

export function nationReadinessVotersQueryOptions(
  nationId: string,
  turnNumber: number,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationReadinessVotersQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationReadinessVoters(client, nationId, turnNumber),
    queryKey: nationReadinessQueryKeys.voters(nationId, turnNumber),
  });
}

async function getNationReadinessVoters(
  client: GubernatorSupabaseClient,
  nationId: string,
  turnNumber: number,
): Promise<readonly NationReadinessVoter[]> {
  const { data: eligibleVoterIds, error: eligibleVoterIdsError } =
    await client.rpc("nation_readiness_eligible_voter_ids", {
      p_nation_id: nationId,
    });

  if (eligibleVoterIdsError !== null) {
    throw normalizeSupabaseError(eligibleVoterIdsError);
  }

  if (eligibleVoterIds.length === 0) {
    return [];
  }

  const [citizensResult, votesResult] = await Promise.all([
    client
      .from("citizen_directory_view")
      .select("id,name")
      .in("id", eligibleVoterIds),
    client
      .from("nation_readiness_votes")
      .select("voter_citizen_id,vote")
      .eq("nation_id", nationId)
      .eq("turn_number", turnNumber),
  ]);

  if (citizensResult.error !== null) {
    throw normalizeSupabaseError(citizensResult.error);
  }
  if (votesResult.error !== null) {
    throw normalizeSupabaseError(votesResult.error);
  }

  const nameByCitizenId = new Map(
    citizensResult.data.map((row) => [row.id, row.name]),
  );
  const voteByCitizenId = new Map(
    votesResult.data.map((row) => [row.voter_citizen_id, row.vote]),
  );

  return eligibleVoterIds
    .map(
      (citizenId): NationReadinessVoter => ({
        citizenId,
        name: nameByCitizenId.get(citizenId) ?? null,
        vote: voteByCitizenId.get(citizenId) ?? null,
      }),
    )
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}
