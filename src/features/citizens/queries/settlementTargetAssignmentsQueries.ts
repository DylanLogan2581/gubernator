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

const SELECT = [
  "citizen_id,assignment_type,trade_route_end,assigned_on_turn_number,created_at,updated_at",
  "job:job_definitions(id,name)",
  "construction_project:construction_projects(id,building_blueprints(name),building_blueprint_tiers(tier_number))",
  "deposit_instance:deposit_instances(id,name,deposit_types(name,job:job_definitions!deposit_types_job_id_fk(name)))",
  "managed_population_instance:managed_population_instances(id,name,managed_population_types(husbandry_job:husbandry_job_id(name),culling_job:culling_job_id(name)))",
  "trade_route:trade_routes(id,resources(name),origin:origin_settlement_id(name),destination:destination_settlement_id(name))",
  "citizens!inner(settlement_id)",
].join(",");

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
