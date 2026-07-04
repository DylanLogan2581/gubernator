import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { toCitizen, type Citizen, type CitizenRow } from "@/features/citizens";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { superadminQueryKeys } from "./superadminQueryKeys";

import type { ActivePlayerCharacterRow } from "./activePlayerCharacterQueries";
import type {
  SuperadminRunningTransition,
  SuperadminUser,
  SuperadminWorld,
  SuperadminWorldAdmin,
} from "../types/superadminTypes";

type AllUsersQueryKey = ReturnType<typeof superadminQueryKeys.users>;
type AllWorldsQueryKey = ReturnType<typeof superadminQueryKeys.worlds>;
type WorldAdminsForUserQueryKey = ReturnType<
  typeof superadminQueryKeys.worldAdminsForUser
>;
type AllUsersQueryOptions = UseQueryOptions<
  readonly SuperadminUser[],
  AuthUiError,
  readonly SuperadminUser[],
  AllUsersQueryKey
>;
type AllWorldsQueryOptions = UseQueryOptions<
  readonly SuperadminWorld[],
  AuthUiError,
  readonly SuperadminWorld[],
  AllWorldsQueryKey
>;
type RunningTransitionsQueryKey = ReturnType<
  typeof superadminQueryKeys.runningTransitions
>;
type RunningTransitionsQueryOptions = UseQueryOptions<
  readonly SuperadminRunningTransition[],
  AuthUiError,
  readonly SuperadminRunningTransition[],
  RunningTransitionsQueryKey
>;
type TrashedWorldsQueryKey = ReturnType<
  typeof superadminQueryKeys.trashedWorlds
>;
type TrashedWorldsQueryOptions = UseQueryOptions<
  readonly SuperadminWorld[],
  AuthUiError,
  readonly SuperadminWorld[],
  TrashedWorldsQueryKey
>;
type WorldAdminsForUserQueryOptions = UseQueryOptions<
  readonly SuperadminWorldAdmin[],
  AuthUiError,
  readonly SuperadminWorldAdmin[],
  WorldAdminsForUserQueryKey
>;

export function allUsersForSuperadminQueryOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): AllUsersQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getAllUsers(client),
    queryKey: superadminQueryKeys.users(),
  });
}

export function allWorldsForSuperadminQueryOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): AllWorldsQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getAllWorlds(client),
    queryKey: superadminQueryKeys.worlds(),
  });
}

export function runningTransitionsQueryOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): RunningTransitionsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getRunningTransitions(client),
    queryKey: superadminQueryKeys.runningTransitions(),
    refetchInterval: 30_000,
  });
}

export function trashedWorldsForSuperadminQueryOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): TrashedWorldsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getTrashedWorlds(client),
    queryKey: superadminQueryKeys.trashedWorlds(),
  });
}

export function worldAdminsForUserQueryOptions(
  userId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldAdminsForUserQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldAdminsForUser(client, userId),
    queryKey: superadminQueryKeys.worldAdminsForUser(userId),
  });
}

async function getAllWorlds(
  client: GubernatorSupabaseClient,
): Promise<readonly SuperadminWorld[]> {
  const { data, error } = await client
    .from("worlds")
    .select("id,name")
    .eq("is_trashed", false)
    .order("name", { ascending: true });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

async function getTrashedWorlds(
  client: GubernatorSupabaseClient,
): Promise<readonly SuperadminWorld[]> {
  const { data, error } = await client
    .from("worlds")
    .select("id,name")
    .eq("is_trashed", true)
    .order("name", { ascending: true });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

async function getRunningTransitions(
  client: GubernatorSupabaseClient,
): Promise<readonly SuperadminRunningTransition[]> {
  const { data, error } = await client
    .from("turn_transitions")
    .select("id,world_id,from_turn_number,to_turn_number,started_at,status")
    .eq("status", "running")
    .order("started_at", { ascending: true });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

async function getAllUsers(
  client: GubernatorSupabaseClient,
): Promise<readonly SuperadminUser[]> {
  const { data, error } = await client
    .from("users")
    .select("created_at,email,id,is_super_admin,status,updated_at,username")
    .order("created_at", { ascending: false });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

async function getWorldAdminsForUser(
  client: GubernatorSupabaseClient,
  userId: string,
): Promise<readonly SuperadminWorldAdmin[]> {
  const { data, error } = await client
    .from("world_admins")
    .select("created_at,id,world_id")
    .eq("user_id", userId);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}

type UserLivingPlayerCharactersQueryKey = ReturnType<
  typeof superadminQueryKeys.userLivingPlayerCharacters
>;
type UserActivePlayerCharacterRowsQueryKey = ReturnType<
  typeof superadminQueryKeys.userActivePlayerCharacterRows
>;

type UserLivingPlayerCharactersQueryOptions = UseQueryOptions<
  readonly Citizen[],
  AuthUiError,
  readonly Citizen[],
  UserLivingPlayerCharactersQueryKey
>;

type UserActivePlayerCharacterRowsQueryOptions = UseQueryOptions<
  readonly ActivePlayerCharacterRow[],
  AuthUiError,
  readonly ActivePlayerCharacterRow[],
  UserActivePlayerCharacterRowsQueryKey
>;

const ADMIN_LIVING_PC_SELECT =
  "id,world_id,settlement_id,citizen_type,given_name,surname,name,sex,status,born_on_turn_number,parent_a_citizen_id,parent_b_citizen_id,user_id,profile_photo_url,role_type,role_nation_id,role_settlement_id,death_cause,death_cause_category,created_at,updated_at";

export function adminUserLivingPlayerCharactersQueryOptions(
  userId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UserLivingPlayerCharactersQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getAdminUserLivingPlayerCharacters(client, userId),
    queryKey: superadminQueryKeys.userLivingPlayerCharacters(userId),
  });
}

export function adminUserActivePlayerCharacterRowsQueryOptions(
  userId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UserActivePlayerCharacterRowsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getAdminUserActivePlayerCharacterRows(client, userId),
    queryKey: superadminQueryKeys.userActivePlayerCharacterRows(userId),
  });
}

async function getAdminUserLivingPlayerCharacters(
  client: GubernatorSupabaseClient,
  userId: string,
): Promise<readonly Citizen[]> {
  const { data, error } = await client
    .from("citizens")
    .select(ADMIN_LIVING_PC_SELECT)
    .eq("user_id", userId)
    .eq("citizen_type", "player_character")
    .eq("status", "alive")
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .returns<CitizenRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCitizen);
}

type ActivePlayerCharacterRowRecord = {
  readonly citizen_id: string;
  readonly updated_at: string;
  readonly user_id: string;
  readonly world_id: string;
};

async function getAdminUserActivePlayerCharacterRows(
  client: GubernatorSupabaseClient,
  userId: string,
): Promise<readonly ActivePlayerCharacterRow[]> {
  const { data, error } = await client
    .from("user_active_player_characters")
    .select("citizen_id,updated_at,user_id,world_id")
    .eq("user_id", userId)
    .returns<ActivePlayerCharacterRowRecord[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map((row) => ({
    citizenId: row.citizen_id,
    updatedAt: row.updated_at,
    userId: row.user_id,
    worldId: row.world_id,
  }));
}
