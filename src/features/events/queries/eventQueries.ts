import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { eventQueryKeys } from "./eventQueryKeys";

import type { Event, EventListFilters } from "../types/eventTypes";

type EventsListQueryKey = ReturnType<typeof eventQueryKeys.list>;
type EventsDetailQueryKey = ReturnType<typeof eventQueryKeys.detail>;

type EventsListQueryOptions = UseQueryOptions<
  readonly Event[],
  AuthUiError,
  readonly Event[],
  EventsListQueryKey
>;
type EventsDetailQueryOptions = UseQueryOptions<
  Event,
  AuthUiError,
  Event,
  EventsDetailQueryKey
>;

// Legacy type exports for backward compatibility
export type EventsError = AuthUiError;
export const isEventsError = (error: unknown): error is AuthUiError =>
  error instanceof Error && "code" in error;

/**
 * List all events for a world, optionally filtered.
 */
export function eventsListQueryOptions(
  worldId: string,
  filters?: EventListFilters,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): EventsListQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: eventQueryKeys.list(worldId),
    queryFn: async (): Promise<Event[]> => {
      let query = client
        .from("events")
        .select("*")
        .eq("world_id", worldId)
        .order("created_at", { ascending: false });

      if (filters?.statusFilter && filters.statusFilter.length > 0) {
        query = query.in("status", filters.statusFilter);
      }

      if (filters?.scopeFilter && filters.scopeFilter.length > 0) {
        query = query.in("scope_type", filters.scopeFilter);
      }

      if (filters?.effectTypeFilter && filters.effectTypeFilter.length > 0) {
        query = query.in("effect_type", filters.effectTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        throw normalizeSupabaseError(error);
      }

      return data ?? [];
    },
  });
}

/**
 * Get a single event with details.
 */
export function eventDetailQueryOptions(
  worldId: string,
  eventId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): EventsDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: eventQueryKeys.detail(worldId, eventId),
    queryFn: async (): Promise<Event> => {
      const { data, error } = await client
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("world_id", worldId)
        .single<Event>();

      if (error) {
        throw normalizeSupabaseError(error);
      }

      if (!data) {
        throw new Error("Event not found");
      }

      return data;
    },
  });
}
