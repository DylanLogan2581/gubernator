import { normalizeAuthError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

export type CitizenKinshipCheckInput = {
  readonly citizenAId: string;
  readonly citizenBId: string;
  readonly depth: number;
};

// Wraps the citizens_have_close_kinship RPC so dialogs and creation flows can
// preview the world's incest-prevention rule without duplicating the
// recursive ancestor walk in client code. The RPC is itself enforced inside
// create_npc / create_player_character, so this helper is a UX aid only.
export async function citizensHaveCloseKinship(
  { citizenAId, citizenBId, depth }: CitizenKinshipCheckInput,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): Promise<boolean> {
  if (depth <= 0) {
    return false;
  }

  const { data, error } = await client.rpc("citizens_have_close_kinship", {
    p_citizen_a_id: citizenAId,
    p_citizen_b_id: citizenBId,
    p_depth: depth,
  });

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data === true;
}
