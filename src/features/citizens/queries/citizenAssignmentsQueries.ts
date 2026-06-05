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
  readonly construction_project: {
    readonly building_blueprint_tiers: { readonly tier_number: number };
    readonly building_blueprints: { readonly name: string };
    readonly id: string;
  } | null;
  readonly created_at: string;
  readonly deposit_instance: {
    readonly deposit_types: {
      readonly job: { readonly name: string };
      readonly name: string;
    };
    readonly id: string;
    readonly name: string;
  } | null;
  readonly job: { readonly id: string; readonly name: string } | null;
  readonly managed_population_instance: {
    readonly id: string;
    readonly managed_population_types: {
      readonly culling_job: { readonly name: string };
      readonly husbandry_job: { readonly name: string };
    };
    readonly name: string;
  } | null;
  readonly trade_route: {
    readonly destination: { readonly name: string };
    readonly id: string;
    readonly origin: { readonly name: string };
    readonly trade_route_legs: readonly {
      readonly direction: string;
      readonly resource: { readonly name: string };
    }[];
  } | null;
  readonly trade_route_end: string | null;
  readonly updated_at: string;
};

type CitizenAssignmentInSettlementRow = CitizenAssignmentRow & {
  readonly citizens: {
    readonly settlement_id: string | null;
  };
};

const CITIZEN_ASSIGNMENT_SELECT = [
  "citizen_id,assignment_type,trade_route_end,assigned_on_turn_number,created_at,updated_at",
  "job:job_definitions(id,name)",
  "construction_project:construction_projects(id,building_blueprints(name),building_blueprint_tiers(tier_number))",
  "deposit_instance:deposit_instances(id,name,deposit_types(name,job:job_definitions!deposit_types_job_id_fk(name)))",
  "managed_population_instance:managed_population_instances(id,name,managed_population_types(husbandry_job:husbandry_job_id(name),culling_job:culling_job_id(name)))",
  "trade_route:trade_routes(id,trade_route_legs(direction,resource:resources(name)),origin:origin_settlement_id(name),destination:destination_settlement_id(name))",
].join(",");

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
    constructionProject:
      row.construction_project === null
        ? null
        : {
            blueprintName: row.construction_project.building_blueprints.name,
            id: row.construction_project.id,
            tierNumber:
              row.construction_project.building_blueprint_tiers.tier_number,
          },
    createdAt: row.created_at,
    depositInstance:
      row.deposit_instance === null
        ? null
        : {
            depositTypeJobName: row.deposit_instance.deposit_types.job.name,
            depositTypeName: row.deposit_instance.deposit_types.name,
            id: row.deposit_instance.id,
            name: row.deposit_instance.name,
          },
    job: row.job,
    managedPopulationInstance:
      row.managed_population_instance === null
        ? null
        : {
            cullingJobName:
              row.managed_population_instance.managed_population_types
                .culling_job.name,
            husbandryJobName:
              row.managed_population_instance.managed_population_types
                .husbandry_job.name,
            id: row.managed_population_instance.id,
            name: row.managed_population_instance.name,
          },
    tradeRoute:
      row.trade_route === null
        ? null
        : {
            destinationSettlementName: row.trade_route.destination.name,
            id: row.trade_route.id,
            legs: row.trade_route.trade_route_legs.map((leg) => ({
              direction: leg.direction as "receive" | "send",
              resourceName: leg.resource.name,
            })),
            originSettlementName: row.trade_route.origin.name,
          },
    tradeRouteEnd: row.trade_route_end,
    updatedAt: row.updated_at,
  };
}

export type { CitizenAssignmentRow };
