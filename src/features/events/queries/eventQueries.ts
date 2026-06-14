import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { eventQueryKeys } from "./eventQueryKeys";

import type {
  Event,
  EventEffect,
  EventListFilters,
  EventWithEffects,
  EventWithGroup,
} from "../types/eventTypes";

type EventsListQueryKey = ReturnType<typeof eventQueryKeys.list>;
type EventsDetailQueryKey = ReturnType<typeof eventQueryKeys.detail>;

type EventsListQueryOptions = UseQueryOptions<
  readonly EventWithGroup[],
  AuthUiError,
  readonly EventWithGroup[],
  EventsListQueryKey
>;
type EventsDetailQueryOptions = UseQueryOptions<
  EventWithEffects,
  AuthUiError,
  EventWithEffects,
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
    queryFn: async (): Promise<readonly EventWithGroup[]> => {
      let query = client
        .from("events")
        .select<"*,event_groups(*)", EventWithGroup>("*,event_groups(*)")
        .eq("world_id", worldId)
        .order("created_at", { ascending: false });

      if (
        filters?.statusFilter !== undefined &&
        filters.statusFilter.length > 0
      ) {
        query = query.in("status", filters.statusFilter);
      }

      if (
        filters?.scopeFilter !== undefined &&
        filters.scopeFilter.length > 0
      ) {
        query = query.in("scope_type", filters.scopeFilter);
      }

      if (
        filters?.effectTypeFilter !== undefined &&
        filters.effectTypeFilter.length > 0
      ) {
        query = query.in("effect_type", filters.effectTypeFilter);
      }

      const { data, error } = await query;

      if (error !== null) {
        throw normalizeSupabaseError(error);
      }

      return data ?? [];
    },
  });
}

/**
 * Get a single event with details and effects.
 */
export function eventDetailQueryOptions(
  worldId: string,
  eventId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): EventsDetailQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: eventQueryKeys.detail(worldId, eventId),
    queryFn: async (): Promise<EventWithEffects> => {
      const { data, error } = await client
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("world_id", worldId)
        .single<Event>();

      if (error !== null) {
        throw normalizeSupabaseError(error);
      }

      if (data === null) {
        throw new Error("Event not found");
      }

      // Fetch related effects
      const { data: effects, error: effectsError } = await client
        .from("event_effects")
        .select("*")
        .eq("event_id", eventId)
        .returns<EventEffect[]>();

      if (effectsError !== null) {
        throw normalizeSupabaseError(effectsError);
      }

      return {
        ...data,
        effects: effects ?? [],
      };
    },
  });
}

/**
 * Get active events affecting a settlement (direct + nation + world scope).
 * Excludes inactive/expired events; include a separate query with status filter for history.
 */
export function activeSettlementEventsQueryOptions(
  worldId: string,
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  readonly Event[],
  AuthUiError,
  readonly Event[],
  ReturnType<typeof eventQueryKeys.bySettlement>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: eventQueryKeys.bySettlement(worldId, settlementId),
    queryFn: async (): Promise<readonly Event[]> => {
      // PostgREST or() does not support subqueries, so resolve nation_id first.
      const { data: settlement, error: settlementError } = await client
        .from("settlements")
        .select("nation_id")
        .eq("id", settlementId)
        .single();

      if (settlementError !== null) {
        throw normalizeSupabaseError(settlementError);
      }

      const nationId = settlement.nation_id;

      const orFilter =
        nationId !== null
          ? `and(scope_type.eq.settlement,scope_settlement_id.eq.${settlementId}),and(scope_type.eq.nation,scope_nation_id.eq.${nationId}),scope_type.eq.world`
          : `and(scope_type.eq.settlement,scope_settlement_id.eq.${settlementId}),scope_type.eq.world`;

      const { data, error } = await client
        .from("events")
        .select<"*", Event>("*")
        .eq("world_id", worldId)
        .eq("status", "active")
        .or(orFilter)
        .order("created_at", { ascending: false });

      if (error !== null) {
        throw normalizeSupabaseError(error);
      }

      return data ?? [];
    },
  });
}

/**
 * Get active events affecting a nation (nation + world scope).
 * Excludes inactive/expired events; include a separate query with status filter for history.
 */
export function activeNationEventsQueryOptions(
  worldId: string,
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  readonly Event[],
  AuthUiError,
  readonly Event[],
  ReturnType<typeof eventQueryKeys.byNation>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: eventQueryKeys.byNation(worldId, nationId),
    queryFn: async (): Promise<readonly Event[]> => {
      const { data, error } = await client
        .from("events")
        .select<"*", Event>("*")
        .eq("world_id", worldId)
        .eq("status", "active")
        .or(
          `and(scope_type.eq.nation,scope_nation_id.eq.${nationId}),scope_type.eq.world`,
        )
        .order("created_at", { ascending: false });

      if (error !== null) {
        throw normalizeSupabaseError(error);
      }

      return data ?? [];
    },
  });
}
