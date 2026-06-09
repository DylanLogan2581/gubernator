/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { describe, it } from "vitest";

import type { Database } from "./database";
// eslint-disable-next-line no-restricted-imports
import type {
  SupabaseAssignmentRow,
  SupabaseBlueprintRow,
  SupabaseBuildingRow,
  SupabaseCitizenRow,
  SupabaseDepositResourceRow,
  SupabaseDepositRow,
  SupabaseDepositTypeRow,
  SupabaseEventRow,
  SupabaseJobRow,
  SupabaseManagedPopRow,
  SupabaseManagedPopTypeRow,
  SupabaseNamesetRow,
  SupabasePartnershipRow,
  SupabaseProjectRow,
  SupabaseResourceRow,
  SupabaseSettlementRow,
  SupabaseStockpileRow,
  SupabaseTierRow,
  SupabaseTradeRouteRow,
  SupabaseWorldRow,
} from "../../supabase/functions/end-turn-simulation/state/rowTypes.ts";

/**
 * Type drift guard: ensures fields in hand-written SupabaseXRow types
 * (in edge functions) stay in sync with generated Database['public']['Tables']['X']['Row'] types.
 *
 * Hand-written types intentionally include only simulation-relevant fields,
 * not all DB columns. This test verifies that for each field that IS included,
 * the generated type has a compatible field definition.
 *
 * If a simulation-relevant column is renamed or retyped in the DB schema and
 * regenerated in database.ts, but the edge function row types are not updated,
 * these type assignments will fail at tsc time, surfacing the drift as a build error.
 *
 * This test runs in the node suite (no Deno or DB access required).
 */

describe("database types drift guard", () => {
  it("should keep edge function row types in sync with generated database types", () => {
    // Type checks below. For each hand-written row type, verify that:
    // 1. The generated type can be assigned to a variable of the hand-written type
    //    (all simulation-relevant fields exist with compatible types)
    // 2. A hand-written type can be assigned to the generated type's more permissive shape
    //    (field types haven't changed in breaking ways)

    const _worldRowCheck: SupabaseWorldRow =
      null as any as Database["public"]["Tables"]["worlds"]["Row"];
    const _worldRowGenCheck: Database["public"]["Tables"]["worlds"]["Row"] =
      null as any as SupabaseWorldRow;

    const _settlementRowCheck: SupabaseSettlementRow =
      null as any as Database["public"]["Tables"]["settlements"]["Row"];
    const _settlementRowGenCheck: Database["public"]["Tables"]["settlements"]["Row"] =
      null as any as SupabaseSettlementRow;

    const _namesetRowCheck: SupabaseNamesetRow =
      null as any as Database["public"]["Tables"]["namesets"]["Row"];
    const _namesetRowGenCheck: Database["public"]["Tables"]["namesets"]["Row"] =
      null as any as SupabaseNamesetRow;

    const _resourceRowCheck: SupabaseResourceRow =
      null as any as Database["public"]["Tables"]["resources"]["Row"];
    const _resourceRowGenCheck: Database["public"]["Tables"]["resources"]["Row"] =
      null as any as SupabaseResourceRow;

    const _stockpileRowCheck: SupabaseStockpileRow =
      null as any as Database["public"]["Tables"]["settlement_resource_stockpiles"]["Row"];
    const _stockpileRowGenCheck: Database["public"]["Tables"]["settlement_resource_stockpiles"]["Row"] =
      null as any as SupabaseStockpileRow;

    const _jobRowCheck: SupabaseJobRow =
      null as any as Database["public"]["Tables"]["jobs"]["Row"];
    const _jobRowGenCheck: Database["public"]["Tables"]["jobs"]["Row"] =
      null as any as SupabaseJobRow;

    const _tierRowCheck: SupabaseTierRow =
      null as any as Database["public"]["Tables"]["building_blueprint_tiers"]["Row"];
    const _tierRowGenCheck: Database["public"]["Tables"]["building_blueprint_tiers"]["Row"] =
      null as any as SupabaseTierRow;

    const _blueprintRowCheck: SupabaseBlueprintRow =
      null as any as Database["public"]["Tables"]["building_blueprints"]["Row"];
    const _blueprintRowGenCheck: Database["public"]["Tables"]["building_blueprints"]["Row"] =
      null as any as SupabaseBlueprintRow;

    const _buildingRowCheck: SupabaseBuildingRow =
      null as any as Database["public"]["Tables"]["buildings"]["Row"];
    const _buildingRowGenCheck: Database["public"]["Tables"]["buildings"]["Row"] =
      null as any as SupabaseBuildingRow;

    const _projectRowCheck: SupabaseProjectRow =
      null as any as Database["public"]["Tables"]["construction_projects"]["Row"];
    const _projectRowGenCheck: Database["public"]["Tables"]["construction_projects"]["Row"] =
      null as any as SupabaseProjectRow;

    const _depositTypeRowCheck: SupabaseDepositTypeRow =
      null as any as Database["public"]["Tables"]["deposit_types"]["Row"];
    const _depositTypeRowGenCheck: Database["public"]["Tables"]["deposit_types"]["Row"] =
      null as any as SupabaseDepositTypeRow;

    const _depositResourceRowCheck: SupabaseDepositResourceRow =
      null as any as Database["public"]["Tables"]["deposit_instance_resources"]["Row"];
    const _depositResourceRowGenCheck: Database["public"]["Tables"]["deposit_instance_resources"]["Row"] =
      null as any as SupabaseDepositResourceRow;

    const _depositRowCheck: SupabaseDepositRow =
      null as any as Database["public"]["Tables"]["deposit_instances"]["Row"];
    const _depositRowGenCheck: Database["public"]["Tables"]["deposit_instances"]["Row"] =
      null as any as SupabaseDepositRow;

    const _managedPopTypeRowCheck: SupabaseManagedPopTypeRow =
      null as any as Database["public"]["Tables"]["managed_population_types"]["Row"];
    const _managedPopTypeRowGenCheck: Database["public"]["Tables"]["managed_population_types"]["Row"] =
      null as any as SupabaseManagedPopTypeRow;

    const _managedPopRowCheck: SupabaseManagedPopRow =
      null as any as Database["public"]["Tables"]["managed_population_instances"]["Row"];
    const _managedPopRowGenCheck: Database["public"]["Tables"]["managed_population_instances"]["Row"] =
      null as any as SupabaseManagedPopRow;

    const _tradeRouteRowCheck: SupabaseTradeRouteRow =
      null as any as Database["public"]["Tables"]["trade_routes"]["Row"];
    const _tradeRouteRowGenCheck: Database["public"]["Tables"]["trade_routes"]["Row"] =
      null as any as SupabaseTradeRouteRow;

    const _citizenRowCheck: SupabaseCitizenRow =
      null as any as Database["public"]["Tables"]["citizens"]["Row"];
    const _citizenRowGenCheck: Database["public"]["Tables"]["citizens"]["Row"] =
      null as any as SupabaseCitizenRow;

    const _assignmentRowCheck: SupabaseAssignmentRow =
      null as any as Database["public"]["Tables"]["citizen_assignments"]["Row"];
    const _assignmentRowGenCheck: Database["public"]["Tables"]["citizen_assignments"]["Row"] =
      null as any as SupabaseAssignmentRow;

    const _partnershipRowCheck: SupabasePartnershipRow =
      null as any as Database["public"]["Tables"]["citizen_partnerships"]["Row"];
    const _partnershipRowGenCheck: Database["public"]["Tables"]["citizen_partnerships"]["Row"] =
      null as any as SupabasePartnershipRow;

    const _eventRowCheck: SupabaseEventRow =
      null as any as Database["public"]["Tables"]["events"]["Row"];
    const _eventRowGenCheck: Database["public"]["Tables"]["events"]["Row"] =
      null as any as SupabaseEventRow;

    // If the code compiles, types match. This is a no-op assertion to silence linter.
    void (
      _worldRowCheck &&
      _worldRowGenCheck &&
      _settlementRowCheck &&
      _settlementRowGenCheck &&
      _namesetRowCheck &&
      _namesetRowGenCheck &&
      _resourceRowCheck &&
      _resourceRowGenCheck &&
      _stockpileRowCheck &&
      _stockpileRowGenCheck &&
      _jobRowCheck &&
      _jobRowGenCheck &&
      _tierRowCheck &&
      _tierRowGenCheck &&
      _blueprintRowCheck &&
      _blueprintRowGenCheck &&
      _buildingRowCheck &&
      _buildingRowGenCheck &&
      _projectRowCheck &&
      _projectRowGenCheck &&
      _depositTypeRowCheck &&
      _depositTypeRowGenCheck &&
      _depositResourceRowCheck &&
      _depositResourceRowGenCheck &&
      _depositRowCheck &&
      _depositRowGenCheck &&
      _managedPopTypeRowCheck &&
      _managedPopTypeRowGenCheck &&
      _managedPopRowCheck &&
      _managedPopRowGenCheck &&
      _tradeRouteRowCheck &&
      _tradeRouteRowGenCheck &&
      _citizenRowCheck &&
      _citizenRowGenCheck &&
      _assignmentRowCheck &&
      _assignmentRowGenCheck &&
      _partnershipRowCheck &&
      _partnershipRowGenCheck &&
      _eventRowCheck &&
      _eventRowGenCheck
    );

    // Test passes if we reach here (types compiled).
    expect(true).toBe(true);
  });
});
