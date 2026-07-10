import { type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { worldScopedQueryOptions } from "@/lib/worldScopedQueryOptions";

import { nationsQueryKeys } from "./nationsQueryKeys";

import type {
  NationActiveConstructionProject,
  NationActiveSubsidy,
  NationLatestTaxSnapshot,
  NationStockpileEntry,
} from "../types/nationTypes";

type NationStockpileQueryKey = ReturnType<
  typeof nationsQueryKeys.treasuryStockpile
>;
type NationStockpileQueryOptions = UseQueryOptions<
  readonly NationStockpileEntry[],
  AuthUiError,
  readonly NationStockpileEntry[],
  NationStockpileQueryKey
>;

const STOCKPILE_SELECT =
  "resource_id,quantity,resources(name,is_system_resource)";

type StockpileRow = {
  readonly quantity: number;
  readonly resource_id: string;
  readonly resources: {
    readonly is_system_resource: boolean;
    readonly name: string;
  };
};

export function nationStockpileQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationStockpileQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationStockpile(c, nationId),
    queryKey: nationsQueryKeys.treasuryStockpile(nationId),
  });
}

async function getNationStockpile(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationStockpileEntry[]> {
  const { data, error } = await client
    .from("nation_resource_stockpiles")
    .select(STOCKPILE_SELECT)
    .eq("nation_id", nationId)
    .returns<StockpileRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data
    .map((row) => ({
      isSystemResource: row.resources.is_system_resource,
      quantity: row.quantity,
      resourceId: row.resource_id,
      resourceName: row.resources.name,
    }))
    .sort((a, b) => a.resourceName.localeCompare(b.resourceName));
}

type NationActiveConstructionProjectsQueryKey = ReturnType<
  typeof nationsQueryKeys.treasuryActiveProjects
>;
type NationActiveConstructionProjectsQueryOptions = UseQueryOptions<
  readonly NationActiveConstructionProject[],
  AuthUiError,
  readonly NationActiveConstructionProject[],
  NationActiveConstructionProjectsQueryKey
>;

const ACTIVE_PROJECT_SELECT =
  "id,settlement_id,settlements!inner(name,nation_id),building_blueprints(name),building_blueprint_tiers(tier_number,construction_costs_json)";

type ActiveProjectRow = {
  readonly building_blueprint_tiers: {
    readonly construction_costs_json: unknown;
    readonly tier_number: number;
  };
  readonly building_blueprints: { readonly name: string };
  readonly id: string;
  readonly settlement_id: string;
  readonly settlements: { readonly name: string; readonly nation_id: string };
};

type ConstructionCostEntry = {
  readonly amount: number;
  readonly resource_id: string;
};

export function nationActiveConstructionProjectsQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationActiveConstructionProjectsQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationActiveConstructionProjects(c, nationId),
    queryKey: nationsQueryKeys.treasuryActiveProjects(nationId),
  });
}

async function getNationActiveConstructionProjects(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationActiveConstructionProject[]> {
  const { data, error } = await client
    .from("construction_projects")
    .select(ACTIVE_PROJECT_SELECT)
    .eq("settlements.nation_id", nationId)
    .in("status", ["queued", "in_progress", "paused"])
    .returns<ActiveProjectRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const resourceIds = new Set<string>();
  for (const row of data) {
    for (const cost of parseConstructionCosts(
      row.building_blueprint_tiers.construction_costs_json,
    )) {
      resourceIds.add(cost.resource_id);
    }
  }

  const resourceNamesById = await getResourceNamesById(client, resourceIds);

  return data.map((row) => ({
    blueprintName: row.building_blueprints.name,
    costs: parseConstructionCosts(
      row.building_blueprint_tiers.construction_costs_json,
    ).map((cost) => ({
      amount: cost.amount,
      resourceId: cost.resource_id,
      resourceName: resourceNamesById.get(cost.resource_id) ?? "Unknown",
    })),
    id: row.id,
    settlementId: row.settlement_id,
    settlementName: row.settlements.name,
    tierNumber: row.building_blueprint_tiers.tier_number,
  }));
}

function parseConstructionCosts(
  json: unknown,
): readonly ConstructionCostEntry[] {
  if (!Array.isArray(json)) {
    return [];
  }
  return json.filter(
    (entry): entry is ConstructionCostEntry =>
      typeof entry === "object" &&
      entry !== null &&
      "resource_id" in entry &&
      "amount" in entry,
  );
}

async function getResourceNamesById(
  client: GubernatorSupabaseClient,
  resourceIds: ReadonlySet<string>,
): Promise<ReadonlyMap<string, string>> {
  if (resourceIds.size === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("resources")
    .select("id,name")
    .in("id", [...resourceIds])
    .returns<{ readonly id: string; readonly name: string }[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return new Map(data.map((row) => [row.id, row.name]));
}

type NationActiveSubsidiesQueryKey = ReturnType<
  typeof nationsQueryKeys.treasuryActiveSubsidies
>;
type NationActiveSubsidiesQueryOptions = UseQueryOptions<
  readonly NationActiveSubsidy[],
  AuthUiError,
  readonly NationActiveSubsidy[],
  NationActiveSubsidiesQueryKey
>;

const ACTIVE_SUBSIDY_SELECT =
  "project_id,resource_id,granted_quantity,construction_projects!inner(settlement_id,settlements!inner(name,nation_id),building_blueprints(name),building_blueprint_tiers(tier_number,construction_costs_json))";

type ActiveSubsidyRow = {
  readonly construction_projects: {
    readonly building_blueprint_tiers: {
      readonly construction_costs_json: unknown;
      readonly tier_number: number;
    };
    readonly building_blueprints: { readonly name: string };
    readonly settlement_id: string;
    readonly settlements: { readonly name: string; readonly nation_id: string };
  };
  readonly granted_quantity: number;
  readonly project_id: string;
  readonly resource_id: string;
};

export function nationActiveSubsidiesQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationActiveSubsidiesQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationActiveSubsidies(c, nationId),
    queryKey: nationsQueryKeys.treasuryActiveSubsidies(nationId),
  });
}

async function getNationActiveSubsidies(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly NationActiveSubsidy[]> {
  const { data, error } = await client
    .from("construction_project_subsidies")
    .select(ACTIVE_SUBSIDY_SELECT)
    .eq("nation_id", nationId)
    .in("construction_projects.status", ["queued", "in_progress", "paused"])
    .returns<ActiveSubsidyRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  const rowsByProject = new Map<string, ActiveSubsidyRow[]>();
  for (const row of data) {
    if (row.construction_projects === null) continue;
    const existing = rowsByProject.get(row.project_id) ?? [];
    existing.push(row);
    rowsByProject.set(row.project_id, existing);
  }

  const resourceIds = new Set<string>();
  for (const rows of rowsByProject.values()) {
    for (const cost of parseConstructionCosts(
      rows[0].construction_projects.building_blueprint_tiers
        .construction_costs_json,
    )) {
      resourceIds.add(cost.resource_id);
    }
  }

  const resourceNamesById = await getResourceNamesById(client, resourceIds);

  return [...rowsByProject.entries()]
    .map(([projectId, rows]) => {
      const project = rows[0].construction_projects;
      const committedByResource = new Map<string, number>();
      for (const row of rows) {
        committedByResource.set(
          row.resource_id,
          (committedByResource.get(row.resource_id) ?? 0) +
            row.granted_quantity,
        );
      }

      return {
        blueprintName: project.building_blueprints.name,
        costs: parseConstructionCosts(
          project.building_blueprint_tiers.construction_costs_json,
        ).map((cost) => ({
          amount: cost.amount,
          committedQuantity: committedByResource.get(cost.resource_id) ?? 0,
          resourceId: cost.resource_id,
          resourceName: resourceNamesById.get(cost.resource_id) ?? "Unknown",
        })),
        projectId,
        settlementId: project.settlement_id,
        settlementName: project.settlements.name,
        tierNumber: project.building_blueprint_tiers.tier_number,
      };
    })
    .sort((a, b) => a.settlementName.localeCompare(b.settlementName));
}

type NationLatestTaxSnapshotQueryKey = ReturnType<
  typeof nationsQueryKeys.treasuryLatestSnapshot
>;
type NationLatestTaxSnapshotQueryOptions = UseQueryOptions<
  NationLatestTaxSnapshot | null,
  AuthUiError,
  NationLatestTaxSnapshot | null,
  NationLatestTaxSnapshotQueryKey
>;

type LatestSnapshotRow = {
  readonly tax_collected_by_resource_json: unknown;
  readonly turn_number: number;
};

export function nationLatestTaxSnapshotQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): NationLatestTaxSnapshotQueryOptions {
  return worldScopedQueryOptions({
    client,
    fetcher: (c) => getNationLatestTaxSnapshot(c, nationId),
    queryKey: nationsQueryKeys.treasuryLatestSnapshot(nationId),
  });
}

async function getNationLatestTaxSnapshot(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<NationLatestTaxSnapshot | null> {
  const { data, error } = await client
    .from("nation_turn_snapshots")
    .select("turn_number,tax_collected_by_resource_json")
    .eq("nation_id", nationId)
    .order("turn_number", { ascending: false })
    .limit(1)
    .maybeSingle<LatestSnapshotRow>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    return null;
  }

  const byResource = data.tax_collected_by_resource_json;
  const totalTaxCollected =
    typeof byResource === "object" && byResource !== null
      ? Object.values(byResource as Record<string, unknown>).reduce<number>(
          (sum, value) => sum + (typeof value === "number" ? value : 0),
          0,
        )
      : 0;

  return {
    totalTaxCollected,
    turnNumber: data.turn_number,
  };
}
