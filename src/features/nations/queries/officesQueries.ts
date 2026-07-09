import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationOfficesQueryKeys } from "./nationOfficesQueryKeys";

import type {
  NationOfficeRosterEntry,
  SettlementOfficeRosterEntry,
} from "../types/nationOfficeTypes";

type NationOfficesRosterQueryKey = ReturnType<
  typeof nationOfficesQueryKeys.roster
>;
type NationOfficesRosterQueryOptions = UseQueryOptions<
  readonly NationOfficeRosterEntry[],
  AuthUiError,
  readonly NationOfficeRosterEntry[],
  NationOfficesRosterQueryKey
>;

export function nationOfficesRosterQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationOfficesRosterQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationOfficesRoster(client, nationId),
    queryKey: nationOfficesQueryKeys.roster(nationId),
  });
}

async function getNationOfficesRoster(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationOfficeRosterEntry[]> {
  const { data: offices, error: officesError } = await client
    .from("nation_offices")
    .select(
      "id,world_id,nation_id,office_type_id,citizen_id,appointed_turn_number,office_types(name)",
    )
    .eq("nation_id", nationId);

  if (officesError !== null) {
    throw normalizeSupabaseError(officesError);
  }

  if (offices.length === 0) {
    return [];
  }

  const citizenIds = [...new Set(offices.map((office) => office.citizen_id))];

  const { data: citizens, error: citizensError } = await client
    .from("citizen_directory_view")
    .select("id,name,citizen_type")
    .in("id", citizenIds);

  if (citizensError !== null) {
    throw normalizeSupabaseError(citizensError);
  }

  const citizenById = new Map(citizens.map((citizen) => [citizen.id, citizen]));

  return offices
    .map((office): NationOfficeRosterEntry => {
      const citizen = citizenById.get(office.citizen_id);
      return {
        appointedTurnNumber: office.appointed_turn_number,
        citizenId: office.citizen_id,
        citizenName: citizen?.name ?? "Unknown citizen",
        citizenType: (citizen?.citizen_type ??
          "npc") as NationOfficeRosterEntry["citizenType"],
        id: office.id,
        nationId: office.nation_id ?? nationId,
        officeTypeId: office.office_type_id,
        officeTypeName: office.office_types?.name ?? "Unknown office",
        worldId: office.world_id,
      };
    })
    .sort((a, b) => {
      if (a.officeTypeName !== b.officeTypeName) {
        return a.officeTypeName.localeCompare(b.officeTypeName);
      }
      return a.citizenName.localeCompare(b.citizenName);
    });
}

type SettlementOfficesRosterQueryKey = ReturnType<
  typeof nationOfficesQueryKeys.settlementRoster
>;
type SettlementOfficesRosterQueryOptions = UseQueryOptions<
  readonly SettlementOfficeRosterEntry[],
  AuthUiError,
  readonly SettlementOfficeRosterEntry[],
  SettlementOfficesRosterQueryKey
>;

export function settlementOfficesRosterQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementOfficesRosterQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementOfficesRoster(client, settlementId),
    queryKey: nationOfficesQueryKeys.settlementRoster(settlementId),
  });
}

async function getSettlementOfficesRoster(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly SettlementOfficeRosterEntry[]> {
  const { data: offices, error: officesError } = await client
    .from("nation_offices")
    .select(
      "id,world_id,settlement_id,office_type_id,citizen_id,appointed_turn_number,office_types(name)",
    )
    .eq("settlement_id", settlementId);

  if (officesError !== null) {
    throw normalizeSupabaseError(officesError);
  }

  if (offices.length === 0) {
    return [];
  }

  const citizenIds = [...new Set(offices.map((office) => office.citizen_id))];

  const { data: citizens, error: citizensError } = await client
    .from("citizen_directory_view")
    .select("id,name,citizen_type")
    .in("id", citizenIds);

  if (citizensError !== null) {
    throw normalizeSupabaseError(citizensError);
  }

  const citizenById = new Map(citizens.map((citizen) => [citizen.id, citizen]));

  return offices
    .map((office): SettlementOfficeRosterEntry => {
      const citizen = citizenById.get(office.citizen_id);
      return {
        appointedTurnNumber: office.appointed_turn_number,
        citizenId: office.citizen_id,
        citizenName: citizen?.name ?? "Unknown citizen",
        citizenType: (citizen?.citizen_type ??
          "npc") as SettlementOfficeRosterEntry["citizenType"],
        id: office.id,
        officeTypeId: office.office_type_id,
        officeTypeName: office.office_types?.name ?? "Unknown office",
        settlementId: office.settlement_id ?? settlementId,
        worldId: office.world_id,
      };
    })
    .sort((a, b) => {
      if (a.officeTypeName !== b.officeTypeName) {
        return a.officeTypeName.localeCompare(b.officeTypeName);
      }
      return a.citizenName.localeCompare(b.citizenName);
    });
}
