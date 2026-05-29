import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { citizensQueryKeys } from "./citizensQueryKeys";

import type { Partnership, PartnershipStatus } from "../types/partnershipTypes";

type PartnershipListQueryKey = ReturnType<
  typeof citizensQueryKeys.partnershipsForCitizen
>;
type ActivePartnershipQueryKey = ReturnType<
  typeof citizensQueryKeys.activePartnershipForCitizen
>;

type PartnershipListQueryOptions = UseQueryOptions<
  readonly Partnership[],
  AuthUiError,
  readonly Partnership[],
  PartnershipListQueryKey
>;
type ActivePartnershipQueryOptions = UseQueryOptions<
  Partnership | null,
  AuthUiError,
  Partnership | null,
  ActivePartnershipQueryKey
>;

type PartnershipRow = {
  readonly change_reason: string | null;
  readonly changed_by_user_id: string | null;
  readonly citizen_a_id: string;
  readonly citizen_b_id: string;
  readonly created_at: string;
  readonly ended_on_turn_number: number | null;
  readonly formed_on_turn_number: number;
  readonly id: string;
  readonly status: PartnershipStatus;
  readonly updated_at: string;
};

const PARTNERSHIP_SELECT =
  "id,citizen_a_id,citizen_b_id,status,formed_on_turn_number,ended_on_turn_number,changed_by_user_id,change_reason,created_at,updated_at";

export function partnershipsForCitizenQueryOptions(
  citizenId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): PartnershipListQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getPartnershipsForCitizen(client, citizenId),
    queryKey: citizensQueryKeys.partnershipsForCitizen(citizenId),
  });
}

export function activePartnershipForCitizenQueryOptions(
  citizenId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): ActivePartnershipQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getActivePartnershipForCitizen(client, citizenId),
    queryKey: citizensQueryKeys.activePartnershipForCitizen(citizenId),
  });
}

async function getPartnershipsForCitizen(
  client: GubernatorSupabaseClient,
  citizenId: string,
): Promise<readonly Partnership[]> {
  // Partnerships can place the citizen on either side of the pair, so we run
  // the two single-column queries in parallel and merge in JS rather than
  // relying on PostgREST's `or=` syntax (which can subtly drop indexes in
  // some Supabase client versions).
  const [aSide, bSide] = await Promise.all([
    client
      .from("partnerships")
      .select(PARTNERSHIP_SELECT)
      .eq("citizen_a_id", citizenId)
      .returns<PartnershipRow[]>(),
    client
      .from("partnerships")
      .select(PARTNERSHIP_SELECT)
      .eq("citizen_b_id", citizenId)
      .returns<PartnershipRow[]>(),
  ]);

  if (aSide.error !== null) {
    throw normalizeSupabaseError(aSide.error);
  }
  if (bSide.error !== null) {
    throw normalizeSupabaseError(bSide.error);
  }

  const merged = new Map<string, PartnershipRow>();
  for (const row of aSide.data) {
    merged.set(row.id, row);
  }
  for (const row of bSide.data) {
    merged.set(row.id, row);
  }

  return [...merged.values()]
    .sort((a, b) => comparePartnershipRecency(a, b))
    .map(toPartnership);
}

async function getActivePartnershipForCitizen(
  client: GubernatorSupabaseClient,
  citizenId: string,
): Promise<Partnership | null> {
  // The partial unique indexes on partnerships(status='active', citizen_a_id)
  // and (status='active', citizen_b_id) guarantee at most one active row per
  // citizen across both columns, so the two single-side lookups can be merged
  // into a single result with maybeSingle semantics.
  const [aSide, bSide] = await Promise.all([
    client
      .from("partnerships")
      .select(PARTNERSHIP_SELECT)
      .eq("citizen_a_id", citizenId)
      .eq("status", "active")
      .maybeSingle<PartnershipRow>(),
    client
      .from("partnerships")
      .select(PARTNERSHIP_SELECT)
      .eq("citizen_b_id", citizenId)
      .eq("status", "active")
      .maybeSingle<PartnershipRow>(),
  ]);

  if (aSide.error !== null) {
    throw normalizeSupabaseError(aSide.error);
  }
  if (bSide.error !== null) {
    throw normalizeSupabaseError(bSide.error);
  }

  const row = aSide.data ?? bSide.data;
  return row === null ? null : toPartnership(row);
}

function comparePartnershipRecency(
  a: PartnershipRow,
  b: PartnershipRow,
): number {
  // Active partnerships sort first; then by ended_on_turn_number desc with a
  // formed_on_turn_number tiebreaker so the most recent history is at the top.
  if (a.status === "active" && b.status !== "active") {
    return -1;
  }
  if (b.status === "active" && a.status !== "active") {
    return 1;
  }
  const aEnded = a.ended_on_turn_number ?? Number.POSITIVE_INFINITY;
  const bEnded = b.ended_on_turn_number ?? Number.POSITIVE_INFINITY;
  if (aEnded !== bEnded) {
    return bEnded - aEnded;
  }
  if (a.formed_on_turn_number !== b.formed_on_turn_number) {
    return b.formed_on_turn_number - a.formed_on_turn_number;
  }
  return a.id < b.id ? 1 : -1;
}

export function toPartnership(row: PartnershipRow): Partnership {
  return {
    changeReason: row.change_reason,
    changedByUserId: row.changed_by_user_id,
    citizenAId: row.citizen_a_id,
    citizenBId: row.citizen_b_id,
    createdAt: row.created_at,
    endedOnTurnNumber: row.ended_on_turn_number,
    formedOnTurnNumber: row.formed_on_turn_number,
    id: row.id,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export type { PartnershipRow };
