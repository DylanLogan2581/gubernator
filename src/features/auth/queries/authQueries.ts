import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { getSupabaseAuthSession } from "@/lib/supabaseAuthState";

import { normalizeAuthError } from "../utils/authErrors";

import { authQueryKeys } from "./authQueryKeys";

import type { AppUser } from "../types/authTypes";
import type { AuthUiError } from "../utils/authErrors";
import type { Session } from "@supabase/supabase-js";

type CurrentSessionQueryKey = ReturnType<typeof authQueryKeys.currentSession>;
type CurrentAppUserQueryKey = ReturnType<typeof authQueryKeys.currentAppUser>;
type CurrentSessionQueryOptions = UseQueryOptions<
  Session | null,
  AuthUiError,
  Session | null,
  CurrentSessionQueryKey
>;
type CurrentAppUserQueryOptions = UseQueryOptions<
  AppUser | null,
  AuthUiError,
  AppUser | null,
  CurrentAppUserQueryKey
>;

export function currentSessionQueryOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CurrentSessionQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCurrentSession(client),
    queryKey: authQueryKeys.currentSession(),
  });
}

export function currentAppUserQueryOptions(
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CurrentAppUserQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCurrentAppUser(client),
    queryKey: authQueryKeys.currentAppUser(),
  });
}

async function getCurrentSession(
  client: GubernatorSupabaseClient,
): Promise<Session | null> {
  try {
    return await getSupabaseAuthSession(client);
  } catch (error) {
    throw normalizeAuthError(error);
  }
}

async function getCurrentAppUser(
  client: GubernatorSupabaseClient,
): Promise<AppUser | null> {
  const session = await getCurrentSession(client);

  if (session === null) {
    return null;
  }

  const { data, error } = await client
    .from("users")
    .select("created_at,email,id,is_super_admin,status,updated_at,username")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data;
}
