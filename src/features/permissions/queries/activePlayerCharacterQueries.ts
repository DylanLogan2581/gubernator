import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import { toCitizen, type Citizen, type CitizenRow } from "@/features/citizens";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { permissionQueryKeys } from "./permissionQueryKeys";

type SelectablePlayerCharactersQueryKey = ReturnType<
  typeof permissionQueryKeys.selectablePlayerCharacters
>;
type ActivePlayerCharacterRowQueryKey = ReturnType<
  typeof permissionQueryKeys.activePlayerCharacterRow
>;

type SelectablePlayerCharactersQueryOptions = UseQueryOptions<
  readonly Citizen[],
  AuthUiError,
  readonly Citizen[],
  SelectablePlayerCharactersQueryKey
>;

export type ActivePlayerCharacterRow = {
  readonly citizenId: string;
  readonly updatedAt: string;
  readonly userId: string;
  readonly worldId: string;
};

type ActivePlayerCharacterRowQueryOptions = UseQueryOptions<
  ActivePlayerCharacterRow | null,
  AuthUiError,
  ActivePlayerCharacterRow | null,
  ActivePlayerCharacterRowQueryKey
>;

const SELECTABLE_PLAYER_CHARACTER_SELECT =
  "id,world_id,settlement_id,citizen_type,name,sex,status,born_on_turn_number,parent_a_citizen_id,parent_b_citizen_id,user_id,profile_photo_url,role_type,role_nation_id,role_settlement_id,personality_text,skills_text,npc_trait_1,npc_trait_2,npc_secret_contradiction,npc_goal,npc_flaw,death_cause,created_at,updated_at";

export function selectablePlayerCharactersQueryOptions(
  userId: string,
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SelectablePlayerCharactersQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSelectablePlayerCharacters(client, userId, worldId),
    queryKey: permissionQueryKeys.selectablePlayerCharacters(userId, worldId),
  });
}

export function activePlayerCharacterRowQueryOptions(
  userId: string,
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActivePlayerCharacterRowQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getActivePlayerCharacterRow(client, userId, worldId),
    queryKey: permissionQueryKeys.activePlayerCharacterRow(userId, worldId),
  });
}

async function getSelectablePlayerCharacters(
  client: GubernatorSupabaseClient,
  userId: string,
  worldId: string,
): Promise<readonly Citizen[]> {
  const { data, error } = await client
    .from("citizens")
    .select(SELECTABLE_PLAYER_CHARACTER_SELECT)
    .eq("world_id", worldId)
    .eq("user_id", userId)
    .eq("citizen_type", "player_character")
    .eq("status", "alive")
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<CitizenRow[]>();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data.map(toCitizen);
}

type ActivePlayerCharacterRowRecord = {
  readonly citizen_id: string;
  readonly updated_at: string;
  readonly user_id: string;
  readonly world_id: string;
};

async function getActivePlayerCharacterRow(
  client: GubernatorSupabaseClient,
  userId: string,
  worldId: string,
): Promise<ActivePlayerCharacterRow | null> {
  const { data, error } = await client
    .from("user_active_player_characters")
    .select("citizen_id,updated_at,user_id,world_id")
    .eq("user_id", userId)
    .eq("world_id", worldId)
    .maybeSingle<ActivePlayerCharacterRowRecord>();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    return null;
  }

  return {
    citizenId: data.citizen_id,
    updatedAt: data.updated_at,
    userId: data.user_id,
    worldId: data.world_id,
  };
}
