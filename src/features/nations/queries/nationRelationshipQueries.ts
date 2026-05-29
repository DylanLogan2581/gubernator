import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "./nationsQueryKeys";

import type {
  NationBilateralStance,
  NationRelationship,
  NationRelationshipPendingStatus,
  NationRelationshipStance,
} from "../types/nationRelationshipTypes";

type NationRelationshipsFromNationQueryKey = ReturnType<
  typeof nationsQueryKeys.relationshipsFromNation
>;
type NationRelationshipsToNationQueryKey = ReturnType<
  typeof nationsQueryKeys.relationshipsToNation
>;
type NationRelationshipPairQueryKey = ReturnType<
  typeof nationsQueryKeys.relationshipPair
>;

type NationRelationshipsFromNationQueryOptions = UseQueryOptions<
  readonly NationRelationship[],
  AuthUiError,
  readonly NationRelationship[],
  NationRelationshipsFromNationQueryKey
>;
type NationRelationshipsToNationQueryOptions = UseQueryOptions<
  readonly NationRelationship[],
  AuthUiError,
  readonly NationRelationship[],
  NationRelationshipsToNationQueryKey
>;
type NationRelationshipPairQueryOptions = UseQueryOptions<
  NationRelationship | null,
  AuthUiError,
  NationRelationship | null,
  NationRelationshipPairQueryKey
>;

type NationRelationshipRow = {
  readonly created_at: string;
  readonly current_stance: string;
  readonly from_nation_id: string;
  readonly id: string;
  readonly pending_changed_by_citizen_id: string | null;
  readonly pending_stance: string | null;
  readonly pending_status: string | null;
  readonly to_nation_id: string;
  readonly updated_at: string;
};

const NATION_RELATIONSHIP_SELECT =
  "id,from_nation_id,to_nation_id,current_stance,pending_stance,pending_status,pending_changed_by_citizen_id,created_at,updated_at";

export function nationRelationshipsFromNationQueryOptions(
  fromNationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationRelationshipsFromNationQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationRelationshipsFromNation(client, fromNationId),
    queryKey: nationsQueryKeys.relationshipsFromNation(fromNationId),
  });
}

export function nationRelationshipsToNationQueryOptions(
  toNationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationRelationshipsToNationQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationRelationshipsToNation(client, toNationId),
    queryKey: nationsQueryKeys.relationshipsToNation(toNationId),
  });
}

export function nationRelationshipPairQueryOptions(
  fromNationId: string,
  toNationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationRelationshipPairQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationRelationshipPair(client, fromNationId, toNationId),
    queryKey: nationsQueryKeys.relationshipPair(fromNationId, toNationId),
  });
}

async function getNationRelationshipsFromNation(
  client: GubernatorSupabaseClient,
  fromNationId: string,
): Promise<readonly NationRelationship[]> {
  const { data, error } = await client
    .from("nation_relationships")
    .select(NATION_RELATIONSHIP_SELECT)
    .eq("from_nation_id", fromNationId)
    .order("to_nation_id", { ascending: true })
    .returns<NationRelationshipRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toNationRelationship);
}

async function getNationRelationshipsToNation(
  client: GubernatorSupabaseClient,
  toNationId: string,
): Promise<readonly NationRelationship[]> {
  const { data, error } = await client
    .from("nation_relationships")
    .select(NATION_RELATIONSHIP_SELECT)
    .eq("to_nation_id", toNationId)
    .order("from_nation_id", { ascending: true })
    .returns<NationRelationshipRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toNationRelationship);
}

async function getNationRelationshipPair(
  client: GubernatorSupabaseClient,
  fromNationId: string,
  toNationId: string,
): Promise<NationRelationship | null> {
  const { data, error } = await client
    .from("nation_relationships")
    .select(NATION_RELATIONSHIP_SELECT)
    .eq("from_nation_id", fromNationId)
    .eq("to_nation_id", toNationId)
    .maybeSingle<NationRelationshipRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toNationRelationship(data);
}

export function toNationRelationship(
  row: NationRelationshipRow,
): NationRelationship {
  return {
    createdAt: row.created_at,
    currentStance: row.current_stance as NationRelationshipStance,
    fromNationId: row.from_nation_id,
    id: row.id,
    pendingChangedByCitizenId: row.pending_changed_by_citizen_id,
    pendingStance:
      row.pending_stance === null
        ? null
        : (row.pending_stance as NationBilateralStance),
    pendingStatus:
      row.pending_status === null
        ? null
        : (row.pending_status as NationRelationshipPendingStatus),
    toNationId: row.to_nation_id,
    updatedAt: row.updated_at,
  };
}

export type { NationRelationshipRow };
