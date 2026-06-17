import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { eventQueryKeys } from "./eventQueryKeys";

import type {
  EventEffect,
  EventListFilters,
  EventWithGroup,
  EventWithGroupAndEffects,
} from "../types/eventTypes";

type EventsListQueryKey = ReturnType<typeof eventQueryKeys.list>;
type EventsDetailQueryKey = ReturnType<typeof eventQueryKeys.detail>;

type EventsListQueryOptions = UseQueryOptions<
  readonly EventWithGroup[],
  AuthUiError,
  readonly EventWithGroup[],
  EventsListQueryKey
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
    queryKey: eventQueryKeys.list(worldId, filters),
    queryFn: async (): Promise<readonly EventWithGroup[]> => {
      let query = client
        .from("events")
        .select<
          "*,group:event_groups(*)",
          EventWithGroup
        >("*,group:event_groups(*)")
        .eq("world_id", worldId);

      const sortBy = filters?.sortBy ?? "created_at";

      // Status sort is lifecycle-ordered client-side; DB order by created_at for everything else
      if (sortBy === "created_at") {
        query = query.order("created_at", { ascending: false });
      }

      if (
        filters?.statusFilter !== undefined &&
        filters.statusFilter.length > 0
      ) {
        query = query.in("status", filters.statusFilter);
      }

      // Handle scope entity filter (specific nation or settlement)
      if (filters?.scopeEntityFilter !== undefined) {
        const { type, id } = filters.scopeEntityFilter;
        if (type === "settlement") {
          // For settlement: need to fetch nation_id first (PostgREST or() doesn't support subqueries)
          const { data: settlement, error: settlementError } = await client
            .from("settlements")
            .select("nation_id")
            .eq("id", id)
            .single();

          if (settlementError !== null) {
            throw normalizeSupabaseError(settlementError);
          }

          const nationId = settlement.nation_id;
          // Include direct settlement scope + nation scope + world scope
          const orFilter =
            nationId !== null
              ? `and(scope_type.eq.settlement,scope_settlement_id.eq.${id}),and(scope_type.eq.nation,scope_nation_id.eq.${nationId}),scope_type.eq.world`
              : `and(scope_type.eq.settlement,scope_settlement_id.eq.${id}),scope_type.eq.world`;
          query = query.or(orFilter);
        } else if (type === "nation") {
          // For nation: include nation + world scope
          const orFilter = `and(scope_type.eq.nation,scope_nation_id.eq.${id}),scope_type.eq.world`;
          query = query.or(orFilter);
        }
      }

      const { data, error } = await query;

      if (error !== null) {
        throw normalizeSupabaseError(error);
      }

      let result: EventWithGroup[] = [...(data ?? [])];

      // Lifecycle-ordered status sort: active > pending > expired > cancelled
      if (sortBy === "status") {
        const lifecycleOrder: Record<string, number> = {
          active: 0,
          pending: 1,
          expired: 2,
          cancelled: 3,
        };
        result = result.sort(
          (a, b) =>
            (lifecycleOrder[a.status] ?? 99) - (lifecycleOrder[b.status] ?? 99),
        );
      }

      return result;
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
): UseQueryOptions<
  EventWithGroupAndEffects,
  AuthUiError,
  EventWithGroupAndEffects,
  EventsDetailQueryKey
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: eventQueryKeys.detail(worldId, eventId),
    queryFn: async (): Promise<EventWithGroupAndEffects> => {
      const { data, error } = await client
        .from("events")
        .select<
          "*,group:event_groups(*)",
          EventWithGroupAndEffects
        >("*,group:event_groups(*)")
        .eq("id", eventId)
        .eq("world_id", worldId)
        .single<EventWithGroupAndEffects>();

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
  readonly EventWithGroup[],
  AuthUiError,
  readonly EventWithGroup[],
  ReturnType<typeof eventQueryKeys.bySettlement>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: eventQueryKeys.bySettlement(worldId, settlementId),
    queryFn: async (): Promise<readonly EventWithGroup[]> => {
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
        .select<
          "*,group:event_groups(*)",
          EventWithGroup
        >("*,group:event_groups(*)")
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
  readonly EventWithGroup[],
  AuthUiError,
  readonly EventWithGroup[],
  ReturnType<typeof eventQueryKeys.byNation>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryKey: eventQueryKeys.byNation(worldId, nationId),
    queryFn: async (): Promise<readonly EventWithGroup[]> => {
      const { data, error } = await client
        .from("events")
        .select<
          "*,group:event_groups(*)",
          EventWithGroup
        >("*,group:event_groups(*)")
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
