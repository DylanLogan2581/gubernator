import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { citizensQueryKeys } from "./citizensQueryKeys";

import type { CitizenAssignment } from "../types/citizenAssignmentTypes";
import type { CitizenAssignmentType } from "../types/citizenTypes";

type CurrentAssignmentQueryKey = ReturnType<
  typeof citizensQueryKeys.currentAssignmentForCitizen
>;
type AssignmentsInSettlementQueryKey = ReturnType<
  typeof citizensQueryKeys.assignmentsInSettlement
>;

type CurrentAssignmentQueryOptions = UseQueryOptions<
  CitizenAssignment | null,
  AuthUiError,
  CitizenAssignment | null,
  CurrentAssignmentQueryKey
>;
type AssignmentsInSettlementQueryOptions = UseQueryOptions<
  readonly CitizenAssignment[],
  AuthUiError,
  readonly CitizenAssignment[],
  AssignmentsInSettlementQueryKey
>;

type CitizenAssignmentRow = {
  readonly assigned_on_turn_number: number;
  readonly assignment_type: CitizenAssignmentType;
  readonly citizen_id: string;
  readonly construction_project_id: string | null;
  readonly created_at: string;
  readonly deposit_instance_id: string | null;
  readonly job_id: string | null;
  readonly managed_population_instance_id: string | null;
  readonly trade_route_end: string | null;
  readonly trade_route_id: string | null;
  readonly updated_at: string;
};

type CitizenAssignmentInSettlementRow = CitizenAssignmentRow & {
  readonly citizens: {
    readonly settlement_id: string | null;
  };
};

const CITIZEN_ASSIGNMENT_SELECT =
  "citizen_id,assignment_type,job_id,construction_project_id,deposit_instance_id,managed_population_instance_id,trade_route_id,trade_route_end,assigned_on_turn_number,created_at,updated_at";

const CITIZEN_ASSIGNMENT_IN_SETTLEMENT_SELECT = `${CITIZEN_ASSIGNMENT_SELECT},citizens!inner(settlement_id)`;

export function currentAssignmentForCitizenQueryOptions(
  citizenId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CurrentAssignmentQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCurrentAssignmentForCitizen(client, citizenId),
    queryKey: citizensQueryKeys.currentAssignmentForCitizen(citizenId),
  });
}

export function assignmentsInSettlementQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): AssignmentsInSettlementQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getAssignmentsInSettlement(client, settlementId),
    queryKey: citizensQueryKeys.assignmentsInSettlement(settlementId),
  });
}

async function getCurrentAssignmentForCitizen(
  client: GubernatorSupabaseClient,
  citizenId: string,
): Promise<CitizenAssignment | null> {
  const { data, error } = await client
    .from("citizen_assignments")
    .select(CITIZEN_ASSIGNMENT_SELECT)
    .eq("citizen_id", citizenId)
    .maybeSingle<CitizenAssignmentRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data === null ? null : toCitizenAssignment(data);
}

async function getAssignmentsInSettlement(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly CitizenAssignment[]> {
  const { data, error } = await client
    .from("citizen_assignments")
    .select(CITIZEN_ASSIGNMENT_IN_SETTLEMENT_SELECT)
    .eq("citizens.settlement_id", settlementId)
    .order("citizen_id", { ascending: true })
    .returns<CitizenAssignmentInSettlementRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCitizenAssignment);
}

export function toCitizenAssignment(
  row: CitizenAssignmentRow,
): CitizenAssignment {
  return {
    assignedOnTurnNumber: row.assigned_on_turn_number,
    assignmentType: row.assignment_type,
    citizenId: row.citizen_id,
    constructionProjectId: row.construction_project_id,
    createdAt: row.created_at,
    depositInstanceId: row.deposit_instance_id,
    jobId: row.job_id,
    managedPopulationInstanceId: row.managed_population_instance_id,
    tradeRouteEnd: row.trade_route_end,
    tradeRouteId: row.trade_route_id,
    updatedAt: row.updated_at,
  };
}

export type { CitizenAssignmentRow };
