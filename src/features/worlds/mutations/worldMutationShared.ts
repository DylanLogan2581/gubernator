import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { worldQueryKeys } from "../queries/worldQueryKeys";

import type { QueryClient } from "@tanstack/react-query";

export type WorldRow = {
  readonly archived_at: string | null;
  readonly calendar_config_json: unknown;
  readonly created_at: string;
  readonly current_turn_number: number;
  readonly id: string;
  readonly incest_prevention_depth: number;
  readonly is_trashed: boolean;
  readonly name: string;
  readonly status: string;
  readonly updated_at: string;
};

export type MutationFactoryOpts = {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
};

export function makeOpts(
  queryClient: QueryClient,
  extraQueryKeys: readonly (readonly unknown[])[] = [],
): { onSuccess: () => Promise<void> } {
  return {
    onSuccess: async (): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: worldQueryKeys.all }),
        ...extraQueryKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ]);
    },
  };
}
