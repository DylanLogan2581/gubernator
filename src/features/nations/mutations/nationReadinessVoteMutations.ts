import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Database } from "@/types/database";

import { nationReadinessQueryKeys } from "../queries/nationReadinessQueryKeys";

type CastNationReadinessVoteRow =
  Database["public"]["Functions"]["cast_nation_readiness_vote"]["Returns"];

export type CastNationReadinessVoteResult = {
  readonly castByUserId: string | null;
  readonly nationId: string;
  readonly turnNumber: number;
  readonly vote: boolean;
  readonly voterCitizenId: string;
};

export type CastNationReadinessVoteInput = {
  readonly nationId: string;
  readonly turnNumber: number;
  readonly vote: boolean;
  readonly voterCitizenId: string;
  readonly worldId: string;
};

export type CastNationReadinessVoteMutationOptions = UseMutationOptions<
  CastNationReadinessVoteResult,
  AuthUiError,
  CastNationReadinessVoteInput
>;

export function castNationReadinessVoteMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CastNationReadinessVoteMutationOptions {
  return mutationOptions({
    mutationFn: (input: CastNationReadinessVoteInput) =>
      castNationReadinessVote(client, input),
    mutationKey: [...nationReadinessQueryKeys.all, "cast-readiness-vote"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: nationReadinessQueryKeys.list(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: nationReadinessQueryKeys.voters(
            input.nationId,
            input.turnNumber,
          ),
        }),
      ]);
    },
  });
}

async function castNationReadinessVote(
  client: GubernatorSupabaseClient,
  input: CastNationReadinessVoteInput,
): Promise<CastNationReadinessVoteResult> {
  const { data, error } = await client
    .rpc("cast_nation_readiness_vote", {
      p_nation_id: input.nationId,
      p_vote: input.vote,
      p_voter_citizen_id: input.voterCitizenId,
    })
    .single();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toCastNationReadinessVoteResult(data);
}

function toCastNationReadinessVoteResult(
  row: CastNationReadinessVoteRow,
): CastNationReadinessVoteResult {
  return {
    castByUserId: row.cast_by_user_id,
    nationId: row.nation_id,
    turnNumber: row.turn_number,
    vote: row.vote,
    voterCitizenId: row.voter_citizen_id,
  };
}
