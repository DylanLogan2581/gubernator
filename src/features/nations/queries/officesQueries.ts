import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { nationOfficesQueryKeys } from "./nationOfficesQueryKeys";

import type {
  NationOfficeHistoryEntry,
  NationOfficeRosterEntry,
  SettlementOfficeHistoryEntry,
  SettlementOfficeRosterEntry,
} from "../types/nationOfficeTypes";

const OFFICE_SELECT =
  "id,world_id,nation_id,settlement_id,office_type_id,citizen_id,appointed_turn_number,term_turns,expires_turn_number,ended_turn_number,office_types(name)";

type OfficeRow = {
  readonly appointed_turn_number: number;
  readonly citizen_id: string;
  readonly ended_turn_number: number | null;
  readonly expires_turn_number: number | null;
  readonly id: string;
  readonly nation_id: string | null;
  readonly office_type_id: string;
  readonly office_types: { readonly name: string } | null;
  readonly settlement_id: string | null;
  readonly term_turns: number | null;
  readonly world_id: string;
};

async function fetchCitizenNamesById(
  client: GubernatorSupabaseClient,
  citizenIds: readonly string[],
): Promise<
  Map<string, { readonly name: string; readonly citizen_type: string }>
> {
  if (citizenIds.length === 0) {
    return new Map();
  }
  const { data: citizens, error } = await client
    .from("citizen_directory_view")
    .select("id,name,citizen_type")
    .in("id", citizenIds);

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return new Map(
    citizens
      .filter(
        (citizen): citizen is typeof citizen & { id: string } =>
          citizen.id !== null,
      )
      .map((citizen) => [
        citizen.id,
        {
          citizen_type: citizen.citizen_type ?? "npc",
          name: citizen.name ?? "Unknown citizen",
        },
      ]),
  );
}

function sortByOfficeThenCitizen<
  T extends { readonly officeTypeName: string; readonly citizenName: string },
>(entries: T[]): T[] {
  return entries.sort((a, b) => {
    if (a.officeTypeName !== b.officeTypeName) {
      return a.officeTypeName.localeCompare(b.officeTypeName);
    }
    return a.citizenName.localeCompare(b.citizenName);
  });
}

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
    .select(OFFICE_SELECT)
    .eq("nation_id", nationId)
    .is("ended_turn_number", null);

  if (officesError !== null) {
    throw normalizeSupabaseError(officesError);
  }

  const citizenById = await fetchCitizenNamesById(client, [
    ...new Set(offices.map((office) => office.citizen_id)),
  ]);

  return sortByOfficeThenCitizen(
    (offices as OfficeRow[]).map((office): NationOfficeRosterEntry => {
      const citizen = citizenById.get(office.citizen_id);
      return {
        appointedTurnNumber: office.appointed_turn_number,
        citizenId: office.citizen_id,
        citizenName: citizen?.name ?? "Unknown citizen",
        citizenType: (citizen?.citizen_type ??
          "npc") as NationOfficeRosterEntry["citizenType"],
        expiresTurnNumber: office.expires_turn_number,
        id: office.id,
        nationId: office.nation_id ?? nationId,
        officeTypeId: office.office_type_id,
        officeTypeName: office.office_types?.name ?? "Unknown office",
        termTurns: office.term_turns,
        worldId: office.world_id,
      };
    }),
  );
}

type NationOfficeHistoryQueryKey = ReturnType<
  typeof nationOfficesQueryKeys.history
>;
type NationOfficeHistoryQueryOptions = UseQueryOptions<
  readonly NationOfficeHistoryEntry[],
  AuthUiError,
  readonly NationOfficeHistoryEntry[],
  NationOfficeHistoryQueryKey
>;

// #1123: ended (term-expired) offices, kept for roster history.
export function nationOfficeHistoryQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationOfficeHistoryQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationOfficeHistory(client, nationId),
    queryKey: nationOfficesQueryKeys.history(nationId),
  });
}

async function getNationOfficeHistory(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationOfficeHistoryEntry[]> {
  const { data: offices, error: officesError } = await client
    .from("nation_offices")
    .select(OFFICE_SELECT)
    .eq("nation_id", nationId)
    .not("ended_turn_number", "is", null)
    .order("ended_turn_number", { ascending: false });

  if (officesError !== null) {
    throw normalizeSupabaseError(officesError);
  }

  const citizenById = await fetchCitizenNamesById(client, [
    ...new Set(offices.map((office) => office.citizen_id)),
  ]);

  return (offices as OfficeRow[]).map((office): NationOfficeHistoryEntry => {
    const citizen = citizenById.get(office.citizen_id);
    return {
      appointedTurnNumber: office.appointed_turn_number,
      citizenId: office.citizen_id,
      citizenName: citizen?.name ?? "Unknown citizen",
      citizenType: (citizen?.citizen_type ??
        "npc") as NationOfficeHistoryEntry["citizenType"],
      endedTurnNumber: office.ended_turn_number as number,
      expiresTurnNumber: office.expires_turn_number,
      id: office.id,
      nationId: office.nation_id ?? nationId,
      officeTypeId: office.office_type_id,
      officeTypeName: office.office_types?.name ?? "Unknown office",
      termTurns: office.term_turns,
      worldId: office.world_id,
    };
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
    .select(OFFICE_SELECT)
    .eq("settlement_id", settlementId)
    .is("ended_turn_number", null);

  if (officesError !== null) {
    throw normalizeSupabaseError(officesError);
  }

  const citizenById = await fetchCitizenNamesById(client, [
    ...new Set(offices.map((office) => office.citizen_id)),
  ]);

  return sortByOfficeThenCitizen(
    (offices as OfficeRow[]).map((office): SettlementOfficeRosterEntry => {
      const citizen = citizenById.get(office.citizen_id);
      return {
        appointedTurnNumber: office.appointed_turn_number,
        citizenId: office.citizen_id,
        citizenName: citizen?.name ?? "Unknown citizen",
        citizenType: (citizen?.citizen_type ??
          "npc") as SettlementOfficeRosterEntry["citizenType"],
        expiresTurnNumber: office.expires_turn_number,
        id: office.id,
        officeTypeId: office.office_type_id,
        officeTypeName: office.office_types?.name ?? "Unknown office",
        settlementId: office.settlement_id ?? settlementId,
        termTurns: office.term_turns,
        worldId: office.world_id,
      };
    }),
  );
}

type SettlementOfficeHistoryQueryKey = ReturnType<
  typeof nationOfficesQueryKeys.settlementHistory
>;
type SettlementOfficeHistoryQueryOptions = UseQueryOptions<
  readonly SettlementOfficeHistoryEntry[],
  AuthUiError,
  readonly SettlementOfficeHistoryEntry[],
  SettlementOfficeHistoryQueryKey
>;

// #1123: ended (term-expired) settlement offices, kept for roster history.
export function settlementOfficeHistoryQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementOfficeHistoryQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementOfficeHistory(client, settlementId),
    queryKey: nationOfficesQueryKeys.settlementHistory(settlementId),
  });
}

async function getSettlementOfficeHistory(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly SettlementOfficeHistoryEntry[]> {
  const { data: offices, error: officesError } = await client
    .from("nation_offices")
    .select(OFFICE_SELECT)
    .eq("settlement_id", settlementId)
    .not("ended_turn_number", "is", null)
    .order("ended_turn_number", { ascending: false });

  if (officesError !== null) {
    throw normalizeSupabaseError(officesError);
  }

  const citizenById = await fetchCitizenNamesById(client, [
    ...new Set(offices.map((office) => office.citizen_id)),
  ]);

  return (offices as OfficeRow[]).map(
    (office): SettlementOfficeHistoryEntry => {
      const citizen = citizenById.get(office.citizen_id);
      return {
        appointedTurnNumber: office.appointed_turn_number,
        citizenId: office.citizen_id,
        citizenName: citizen?.name ?? "Unknown citizen",
        citizenType: (citizen?.citizen_type ??
          "npc") as SettlementOfficeHistoryEntry["citizenType"],
        endedTurnNumber: office.ended_turn_number as number,
        expiresTurnNumber: office.expires_turn_number,
        id: office.id,
        officeTypeId: office.office_type_id,
        officeTypeName: office.office_types?.name ?? "Unknown office",
        settlementId: office.settlement_id ?? settlementId,
        termTurns: office.term_turns,
        worldId: office.world_id,
      };
    },
  );
}
