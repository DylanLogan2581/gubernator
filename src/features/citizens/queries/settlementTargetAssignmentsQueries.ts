import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import {
  toCitizenAssignment,
  type CitizenAssignmentRow,
} from "./citizenAssignmentsQueries";
import { citizensQueryKeys } from "./citizensQueryKeys";

import type { CitizenAssignment } from "../types/citizenAssignmentTypes";

type SettlementTargetAssignmentsQueryKey = ReturnType<
  typeof citizensQueryKeys.settlementTargetAssignments
>;

type SettlementTargetAssignmentsQueryOptions = UseQueryOptions<
  readonly CitizenAssignment[],
  AuthUiError,
  readonly CitizenAssignment[],
  SettlementTargetAssignmentsQueryKey
>;

type CitizenAssignmentInSettlementRow = CitizenAssignmentRow & {
  readonly citizens: {
    readonly settlement_id: string | null;
  };
};

const SELECT =
  "citizen_id,assignment_type,job_id,construction_project_id,deposit_instance_id,managed_population_instance_id,trade_route_id,trade_route_end,assigned_on_turn_number,created_at,updated_at,citizens!inner(settlement_id)";

const PER_TARGET_TYPES = [
  "deposit",
  "husbandry",
  "culling",
  "trade_route",
] as const;

export function settlementTargetAssignmentsQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): SettlementTargetAssignmentsQueryOptions {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementTargetAssignments(client, settlementId),
    queryKey: citizensQueryKeys.settlementTargetAssignments(settlementId),
  });
}

async function getSettlementTargetAssignments(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly CitizenAssignment[]> {
  const { data, error } = await client
    .from("citizen_assignments")
    .select(SELECT)
    .eq("citizens.settlement_id", settlementId)
    .in("assignment_type", [...PER_TARGET_TYPES])
    .order("citizen_id", { ascending: true })
    .returns<CitizenAssignmentInSettlementRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toCitizenAssignment);
}
