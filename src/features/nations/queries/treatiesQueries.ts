import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationsQueryKeys } from "./nationsQueryKeys";

import type {
  NationTreaty,
  NationTreatyStatus,
  NationTreatyTerms,
  NationTreatyType,
} from "../types/nationTreatyTypes";

type NationTreatiesQueryKey = ReturnType<typeof nationsQueryKeys.treaties>;
type NationTreatiesQueryOptions = UseQueryOptions<
  readonly NationTreaty[],
  AuthUiError,
  readonly NationTreaty[],
  NationTreatiesQueryKey
>;

export type NationTreatyRow = {
  readonly created_at: string;
  readonly ends_turn_number: number | null;
  readonly id: string;
  readonly proposed_by_citizen_id: string | null;
  readonly proposer_nation_id: string;
  readonly responded_by_citizen_id: string | null;
  readonly responder_nation_id: string;
  readonly starts_turn_number: number | null;
  readonly status: string;
  readonly terms: unknown;
  readonly treaty_type: string;
  readonly updated_at: string;
  readonly world_id: string;
};

const NATION_TREATY_SELECT =
  "id,world_id,proposer_nation_id,responder_nation_id,treaty_type,terms,status,starts_turn_number,ends_turn_number,proposed_by_citizen_id,responded_by_citizen_id,created_at,updated_at";

export function nationTreatiesQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationTreatiesQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationTreaties(client, nationId),
    queryKey: nationsQueryKeys.treaties(nationId),
  });
}

async function getNationTreaties(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationTreaty[]> {
  const { data, error } = await client
    .from("nation_treaties")
    .select(NATION_TREATY_SELECT)
    .or(`proposer_nation_id.eq.${nationId},responder_nation_id.eq.${nationId}`)
    .order("created_at", { ascending: false })
    .returns<NationTreatyRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toNationTreaty);
}

export function toNationTreatyTerms(
  treatyType: string,
  terms: unknown,
): NationTreatyTerms {
  const raw = (terms ?? {}) as Record<string, unknown>;

  if (treatyType === "tribute") {
    return {
      payer: raw.payer as "proposer" | "responder",
      quantityPerTurn: Number(raw.quantity_per_turn),
      resourceId: raw.resource_id as string,
    };
  }

  if (treatyType === "royal_marriage") {
    return {
      citizenAId: raw.citizen_a_id as string,
      citizenBId: raw.citizen_b_id as string,
    };
  }

  return raw;
}

export function toNationTreaty(row: NationTreatyRow): NationTreaty {
  return {
    createdAt: row.created_at,
    endsTurnNumber: row.ends_turn_number,
    id: row.id,
    proposedByCitizenId: row.proposed_by_citizen_id,
    proposerNationId: row.proposer_nation_id,
    respondedByCitizenId: row.responded_by_citizen_id,
    responderNationId: row.responder_nation_id,
    startsTurnNumber: row.starts_turn_number,
    status: row.status as NationTreatyStatus,
    terms: toNationTreatyTerms(row.treaty_type, row.terms),
    treatyType: row.treaty_type as NationTreatyType,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}
