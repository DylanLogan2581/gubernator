import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { educationEnrollmentsQueryKeys } from "./educationEnrollmentsQueryKeys";

import type {
  EducationSummary,
  SchoolEnrollment,
  SettlementEducationSnapshot,
} from "../types/educationEnrollmentTypes";

const SCHOOL_ENROLLMENT_SELECT =
  "id,citizen_id,target_level_id,progress_turns,enrolled_turn_number,citizens!inner(name),education_levels!inner(name)";

type SchoolEnrollmentRow = {
  readonly citizen_id: string;
  readonly citizens: { readonly name: string };
  readonly education_levels: { readonly name: string };
  readonly enrolled_turn_number: number;
  readonly id: string;
  readonly progress_turns: number;
  readonly target_level_id: string;
};

function toSchoolEnrollment(row: SchoolEnrollmentRow): SchoolEnrollment {
  return {
    citizenId: row.citizen_id,
    citizenName: row.citizens.name,
    enrolledTurnNumber: row.enrolled_turn_number,
    id: row.id,
    progressTurns: row.progress_turns,
    targetLevelId: row.target_level_id,
    targetLevelName: row.education_levels.name,
  };
}

type SchoolEnrollmentsQueryKey = ReturnType<
  typeof educationEnrollmentsQueryKeys.bySchool
>;

type SchoolEnrollmentsQueryOptions = UseQueryOptions<
  readonly SchoolEnrollment[],
  AuthUiError,
  readonly SchoolEnrollment[],
  SchoolEnrollmentsQueryKey
>;

export function schoolEnrollmentsQueryOptions(
  settlementBuildingId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SchoolEnrollmentsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSchoolEnrollments(client, settlementBuildingId),
    queryKey: educationEnrollmentsQueryKeys.bySchool(settlementBuildingId),
  });
}

async function getSchoolEnrollments(
  client: GubernatorSupabaseClient,
  settlementBuildingId: string,
): Promise<readonly SchoolEnrollment[]> {
  const { data, error } = await client
    .from("education_enrollments")
    .select(SCHOOL_ENROLLMENT_SELECT)
    .eq("settlement_building_id", settlementBuildingId)
    .order("citizens(name)", { ascending: true })
    .returns<SchoolEnrollmentRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toSchoolEnrollment);
}

type SettlementEnrolledCitizenIdsQueryKey = ReturnType<
  typeof educationEnrollmentsQueryKeys.bySettlement
>;

type SettlementEnrolledCitizenIdsQueryOptions = UseQueryOptions<
  readonly string[],
  AuthUiError,
  readonly string[],
  SettlementEnrolledCitizenIdsQueryKey
>;

export function settlementEnrolledCitizenIdsQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementEnrolledCitizenIdsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementEnrolledCitizenIds(client, settlementId),
    queryKey: educationEnrollmentsQueryKeys.bySettlement(settlementId),
  });
}

type SettlementEnrolledCitizenIdRow = {
  readonly citizen_id: string;
};

async function getSettlementEnrolledCitizenIds(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly string[]> {
  const { data, error } = await client
    .from("education_enrollments")
    .select("citizen_id,settlement_buildings!inner(settlement_id)")
    .eq("settlement_buildings.settlement_id", settlementId)
    .returns<SettlementEnrolledCitizenIdRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map((row) => row.citizen_id);
}

type SettlementEducationSummaryQueryKey = ReturnType<
  typeof educationEnrollmentsQueryKeys.summaryBySettlement
>;

type SettlementEducationSummaryQueryOptions = UseQueryOptions<
  SettlementEducationSnapshot | null,
  AuthUiError,
  SettlementEducationSnapshot | null,
  SettlementEducationSummaryQueryKey
>;

export function settlementEducationSummaryQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementEducationSummaryQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementEducationSummary(client, settlementId),
    queryKey: educationEnrollmentsQueryKeys.summaryBySettlement(settlementId),
  });
}

type SettlementEducationSummaryRow = {
  readonly education_summary_json: unknown;
  readonly turn_number: number;
};

function parseEducationSummary(payload: unknown): EducationSummary {
  if (payload === null || typeof payload !== "object") {
    return { countsByLevelId: {}, graduationsThisTurn: 0 };
  }
  const p = payload as Record<string, unknown>;
  const countsByLevelId =
    typeof p.countsByLevelId === "object" && p.countsByLevelId !== null
      ? (p.countsByLevelId as Record<string, number>)
      : {};
  const graduationsThisTurn =
    typeof p.graduationsThisTurn === "number" ? p.graduationsThisTurn : 0;
  return { countsByLevelId, graduationsThisTurn };
}

async function getSettlementEducationSummary(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<SettlementEducationSnapshot | null> {
  const { data, error } = await client
    .from("settlement_turn_snapshots")
    .select("turn_number,education_summary_json")
    .eq("settlement_id", settlementId)
    .order("turn_number", { ascending: false })
    .limit(1)
    .maybeSingle<SettlementEducationSummaryRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) return null;

  return {
    ...parseEducationSummary(data.education_summary_json),
    turnNumber: data.turn_number,
  };
}
