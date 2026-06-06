import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { superadminQueryKeys } from "./superadminQueryKeys";

import type {
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
    .select("id,name,owner_id")
    .eq("is_trashed", false)
    .order("name", { ascending: true });

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
