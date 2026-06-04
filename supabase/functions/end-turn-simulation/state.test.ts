import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSupabaseEndTurnSimulationInput } from "./state";

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000002";
const FOOD_ID = "00000000-0000-0000-0000-000000000010";
const WATER_ID = "00000000-0000-0000-0000-000000000011";
const JOB_ID = "00000000-0000-0000-0000-000000000020";
const BLUEPRINT_ID = "00000000-0000-0000-0000-000000000030";
const TIER_ID = "00000000-0000-0000-0000-000000000031";
const BUILDING_ID = "00000000-0000-0000-0000-000000000040";
const PROJECT_ID = "00000000-0000-0000-0000-000000000050";
const DEPOSIT_TYPE_ID = "00000000-0000-0000-0000-000000000060";
const DEPOSIT_ID = "00000000-0000-0000-0000-000000000061";
const DEPOSIT_RES_ID = "00000000-0000-0000-0000-000000000062";
const RESOURCE_ID = "00000000-0000-0000-0000-000000000070";
const MANAGED_POP_TYPE_ID = "00000000-0000-0000-0000-000000000080";
const MANAGED_POP_ID = "00000000-0000-0000-0000-000000000081";
const TRADE_ROUTE_ID = "00000000-0000-0000-0000-000000000090";
const CITIZEN_ID = "00000000-0000-0000-0000-000000000100";
const PARTNER_ID = "00000000-0000-0000-0000-000000000101";
const PARTNERSHIP_ID = "00000000-0000-0000-0000-000000000102";
const EVENT_ID = "00000000-0000-0000-0000-000000000110";

function makeCalendarConfig(): Record<string, unknown> {
  return {
    dateFormatTemplate: "{year}-{month}-{day}",
    months: [{ dayCount: 30, index: 0, name: "Firstmonth" }],
    startingDayOfMonth: 1,
    startingMonthIndex: 0,
    startingWeekdayOffset: 0,
    startingYear: 1,
    weekdays: [{ index: 0, name: "Firstday" }],
  };
}

function makeWorldRow(): Record<string, unknown> {
  return {
    calendar_config_json: makeCalendarConfig(),
    current_turn_number: 5,
    fertility_chance: 0.1,
    food_consumption_per_citizen: 1.0,
    homelessness_decline_rate: 0.2,
    id: WORLD_ID,
    incest_prevention_depth: 4,
    maximum_fertility_age_turns: null,
    minimum_partnership_age_turns: 18,
    mourning_period_turns: 3,
    npc_flavor_config_json: {
      contradictions: ["contra1"],
      flaws: ["flaw1"],
      goals: ["goal1"],
      traits: ["trait1"],
    },
    partnership_seek_chance: 0.3,
    starvation_severity_multiplier: 1.0,
    status: "active",
    water_consumption_per_citizen: 1.0,
  };
}

/**
 * Creates a fetch mock keyed on URL substrings.
 * The first matching key wins; call order is tracked but not required to be sequential.
 */
function stubSupabaseFetch(
  responses: Record<string, { body: unknown; status: number }>,
): ReturnType<typeof vi.fn> {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string): string | undefined => {
        if (name === "SUPABASE_URL") return "http://localhost:54321";
        if (name === "SUPABASE_ANON_KEY") return "test-anon-key";
        return undefined;
      },
    },
  });

  const fetchMock = vi.fn((url: string): Promise<Response> => {
    const entry = Object.entries(responses).find(([pattern]) =>
      url.includes(pattern),
    );
    const { body, status } = entry?.[1] ?? {
      body: { error: `Unexpected fetch call: ${url}` },
      status: 500,
    };
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makeAuthContext(): { authorizationHeader: string; userId: string } {
  return {
    authorizationHeader: "Bearer test-token",
    userId: "user-1",
  };
}

function makeRequestBody(): { expectedTurnNumber: number; worldId: string } {
  return { expectedTurnNumber: 5, worldId: WORLD_ID };
}

function makeAllSuccessResponses(): Record<
  string,
  { body: unknown; status: number }
> {
  return {
    "/rest/v1/worlds": {
      body: [makeWorldRow()],
      status: 200,
    },
    "/rest/v1/settlements": {
      body: [
        {
          id: SETTLEMENT_ID,
          name: "Settlement One",
          is_ready_current_turn: false,
          auto_ready_enabled: false,
          nations: {},
        },
      ],
      status: 200,
    },
    "/rest/v1/resources": {
      body: [
        { id: FOOD_ID, slug: "food" },
        { id: WATER_ID, slug: "fresh-water" },
      ],
      status: 200,
    },
    "/rest/v1/settlement_stockpiles_view": {
      body: [
        {
          effective_cap: 200,
          quantity: 50,
          resource_id: FOOD_ID,
          settlement_id: SETTLEMENT_ID,
        },
      ],
      status: 200,
    },
    "/rest/v1/job_definitions": {
      body: [
        {
          base_capacity: 5,
          id: JOB_ID,
          inputs_json: [{ amount_per_worker: 1, resource_id: FOOD_ID }],
          job_type: "standard",
          linked_deposit_type_id: null,
          linked_managed_population_type_id: null,
          name: "Farming",
          outputs_json: [{ amount_per_worker: 3, resource_id: FOOD_ID }],
          trader_capacity_per_worker: null,
        },
      ],
      status: 200,
    },
    "/rest/v1/building_blueprints": {
      body: [
        {
          building_blueprint_tiers: [
            {
              building_blueprint_id: BLUEPRINT_ID,
              construction_costs_json: [
                { amount: 10, resource_id: RESOURCE_ID },
              ],
              effects_json: [{ amount: 5, type: "population_cap_increase" }],
              id: TIER_ID,
              tier_number: 1,
              upkeep_costs_json: [{ amount: 1, resource_id: FOOD_ID }],
              worker_turns_required: 10,
            },
          ],
          grace_period_turns: 2,
          id: BLUEPRINT_ID,
          max_instances_per_settlement: null,
          name: "Farm",
        },
      ],
      status: 200,
    },
    "/rest/v1/settlement_buildings": {
      body: [
        {
          activated_on_turn_number: 1,
          building_blueprint_id: BLUEPRINT_ID,
          current_tier_id: TIER_ID,
          id: BUILDING_ID,
          missed_upkeep_count: 0,
          settlement_id: SETTLEMENT_ID,
          source_project_id: null,
          state: "active",
        },
      ],
      status: 200,
    },
    "/rest/v1/construction_projects": {
      body: [
        {
          building_blueprint_id: BLUEPRINT_ID,
          id: PROJECT_ID,
          progress_worker_turns: 3,
          queue_position: 1,
          settlement_id: SETTLEMENT_ID,
          status: "in_progress",
          target_tier: { worker_turns_required: 10 },
          target_tier_id: TIER_ID,
        },
      ],
      status: 200,
    },
    "/rest/v1/deposit_types": {
      body: [
        {
          id: DEPOSIT_TYPE_ID,
          job_id: JOB_ID,
          name: "Iron Vein",
          output_units_per_worker: 2,
          worker_inputs_json: [
            { amount_per_worker: 0.5, resource_id: FOOD_ID },
          ],
        },
      ],
      status: 200,
    },
    "/rest/v1/deposit_instances": {
      body: [
        {
          deposit_instance_resources: [
            {
              id: DEPOSIT_RES_ID,
              remaining_quantity: 100,
              resource_id: RESOURCE_ID,
            },
          ],
          deposit_type_id: DEPOSIT_TYPE_ID,
          id: DEPOSIT_ID,
          max_workers: 3,
          name: "Iron Vein Alpha",
          settlement_id: SETTLEMENT_ID,
          status: "active",
        },
      ],
      status: 200,
    },
    "/rest/v1/managed_population_types": {
      body: [
        {
          culling_job_id: JOB_ID,
          culling_outputs_json: [
            { amount_per_n_animals: 1, resource_id: RESOURCE_ID },
          ],
          growth_rate: 0.05,
          husbandry_job_id: JOB_ID,
          husbandry_workers_per_n_animals: 2,
          id: MANAGED_POP_TYPE_ID,
          maintenance_rules_json: [
            { amount_per_n_animals: 0.5, resource_id: FOOD_ID },
          ],
          name: "Sheep",
        },
      ],
      status: 200,
    },
    "/rest/v1/managed_population_instances": {
      body: [
        {
          configured_cull_quantity: 5,
          current_count: 20,
          id: MANAGED_POP_ID,
          managed_population_type_id: MANAGED_POP_TYPE_ID,
          name: "Town Flock",
          settlement_id: SETTLEMENT_ID,
          status: "active",
        },
      ],
      status: 200,
    },
    "/rest/v1/trade_routes": {
      body: [
        {
          destination_settlement_id: SETTLEMENT_ID,
          id: TRADE_ROUTE_ID,
          origin_settlement_id: SETTLEMENT_ID,
          quantity_per_transition: 10,
          resource_id: FOOD_ID,
          status: "active",
        },
      ],
      status: 200,
    },
    "/rest/v1/citizens": {
      body: [
        {
          born_on_turn_number: 1,
          citizen_type: "npc",
          id: CITIZEN_ID,
          name: "Alice",
          parent_a_citizen_id: null,
          parent_b_citizen_id: null,
          settlement_id: SETTLEMENT_ID,
          sex: "female",
          status: "alive",
        },
        {
          born_on_turn_number: 2,
          citizen_type: "npc",
          id: PARTNER_ID,
          name: "Bob",
          parent_a_citizen_id: null,
          parent_b_citizen_id: null,
          settlement_id: SETTLEMENT_ID,
          sex: "male",
          status: "alive",
        },
      ],
      status: 200,
    },
    "/rest/v1/events": {
      body: [
        {
          activate_on_transition_after_turn_number: 4,
          effect_payload_jsonb: { amount: 100, resource_id: RESOURCE_ID },
          effect_type: "resource_grant",
          id: EVENT_ID,
          status: "pending",
        },
      ],
      status: 200,
    },
    "/rest/v1/citizen_assignments": {
      body: [
        {
          assigned_on_turn_number: 3,
          assignment_type: "standard_job",
          citizens: {},
          citizen_id: CITIZEN_ID,
          construction_project_id: null,
          deposit_instance_id: null,
          job_id: JOB_ID,
          managed_population_instance_id: null,
          trade_route_end: null,
          trade_route_id: null,
        },
      ],
      status: 200,
    },
    "/rest/v1/partnerships": {
      body: [
        {
          "citizens!citizen_a_id": {},
          citizen_a_id: CITIZEN_ID,
          citizen_b_id: PARTNER_ID,
          ended_on_turn_number: null,
          formed_on_turn_number: 3,
          id: PARTNERSHIP_ID,
          status: "active",
        },
      ],
      status: 200,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveSupabaseEndTurnSimulationInput", () => {
  it("returns a fully-populated SimulationInputState for a representative fixture", async () => {
    stubSupabaseFetch(makeAllSuccessResponses());

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { input } = result;

    // World metadata
    expect(input.worldId).toBe(WORLD_ID);
    expect(input.turnNumber).toBe(5);
    expect(input.isWorldArchived).toBe(false);
    expect(input.settlementId).toBe(WORLD_ID);

    // Calendar config
    expect(input.calendarConfig.weekdays).toHaveLength(1);
    expect(input.calendarConfig.months).toHaveLength(1);
    expect(input.calendarConfig.startingYear).toBe(1);

    // Population rules
    expect(input.populationRules.fertilityChance).toBe(0.1);
    expect(input.populationRules.incestPreventionDepth).toBe(4);
    expect(input.populationRules.maximumFertilityAgeTurns).toBeNull();

    // NPC flavor
    expect(input.npcFlavorConfig?.traits).toEqual(["trait1"]);
    expect(input.npcFlavorConfig?.flaws).toEqual(["flaw1"]);

    // Settlements
    expect(input.settlements).toHaveLength(1);
    expect(input.settlements[0]).toEqual({
      autoReadyEnabled: false,
      id: SETTLEMENT_ID,
      isReadyCurrentTurn: false,
      name: "Settlement One",
    });

    // System resources
    expect(input.systemResourceIds.foodId).toBe(FOOD_ID);
    expect(input.systemResourceIds.freshWaterId).toBe(WATER_ID);

    // Stockpiles
    expect(input.stockpiles).toHaveLength(1);
    expect(input.stockpiles[0]).toEqual({
      cap: 200,
      quantity: 50,
      resourceId: FOOD_ID,
      settlementId: SETTLEMENT_ID,
    });

    // Jobs
    expect(input.jobs).toHaveLength(1);
    const job = input.jobs[0];
    expect(job.id).toBe(JOB_ID);
    expect(job.name).toBe("Farming");
    expect(job.jobType).toBe("standard");
    expect(job.baseCapacity).toBe(5);
    expect(job.inputsJson).toEqual([
      { amountPerWorker: 1, resourceId: FOOD_ID },
    ]);
    expect(job.outputsJson).toEqual([
      { amountPerWorker: 3, resourceId: FOOD_ID },
    ]);

    // Blueprints + tiers
    expect(input.buildingBlueprints).toHaveLength(1);
    const bp = input.buildingBlueprints[0];
    expect(bp.id).toBe(BLUEPRINT_ID);
    expect(bp.gracePeriodTurns).toBe(2);
    expect(bp.maxInstancesPerSettlement).toBeNull();

    expect(input.buildingTiers).toHaveLength(1);
    const tier = input.buildingTiers[0];
    expect(tier.id).toBe(TIER_ID);
    expect(tier.workerTurnsRequired).toBe(10);
    expect(tier.constructionCostsJson).toEqual([
      { amount: 10, resourceId: RESOURCE_ID },
    ]);
    expect(tier.upkeepCostsJson).toEqual([{ amount: 1, resourceId: FOOD_ID }]);
    expect(tier.effectsJson).toEqual([
      { amount: 5, type: "population_cap_increase" },
    ]);

    // Settlement buildings
    expect(input.settlementBuildings).toHaveLength(1);
    const building = input.settlementBuildings[0];
    expect(building.id).toBe(BUILDING_ID);
    expect(building.state).toBe("active");
    expect(building.missedUpkeepCount).toBe(0);
    expect(building.activatedOnTurnNumber).toBe(1);
    expect(building.sourceProjectId).toBeNull();

    // Construction projects
    expect(input.constructionProjects).toHaveLength(1);
    const project = input.constructionProjects[0];
    expect(project.id).toBe(PROJECT_ID);
    expect(project.status).toBe("in_progress");
    expect(project.progressWorkerTurns).toBe(3);
    expect(project.workerTurnsRequired).toBe(10);

    // Deposit types
    expect(input.depositTypes).toHaveLength(1);
    const depositType = input.depositTypes[0];
    expect(depositType.id).toBe(DEPOSIT_TYPE_ID);
    expect(depositType.outputUnitsPerWorker).toBe(2);
    expect(depositType.workerInputsJson).toEqual([
      { amountPerWorker: 0.5, resourceId: FOOD_ID },
    ]);

    // Deposits
    expect(input.deposits).toHaveLength(1);
    const deposit = input.deposits[0];
    expect(deposit.id).toBe(DEPOSIT_ID);
    expect(deposit.status).toBe("active");
    expect(deposit.maxWorkers).toBe(3);
    expect(deposit.resources).toHaveLength(1);
    expect(deposit.resources[0]).toEqual({
      depositInstanceId: DEPOSIT_ID,
      id: DEPOSIT_RES_ID,
      remainingQuantity: 100,
      resourceId: RESOURCE_ID,
    });

    // Managed population types
    expect(input.managedPopulationTypes).toHaveLength(1);
    const mpt = input.managedPopulationTypes[0];
    expect(mpt.id).toBe(MANAGED_POP_TYPE_ID);
    expect(mpt.growthRate).toBe(0.05);
    expect(mpt.maintenanceRulesJson).toEqual([
      { amountPerNAnimals: 0.5, resourceId: FOOD_ID },
    ]);
    expect(mpt.cullingOutputsJson).toEqual([
      { amountPerNAnimals: 1, resourceId: RESOURCE_ID },
    ]);

    // Managed populations
    expect(input.managedPopulations).toHaveLength(1);
    const mp = input.managedPopulations[0];
    expect(mp.id).toBe(MANAGED_POP_ID);
    expect(mp.currentCount).toBe(20);
    expect(mp.configuredCullQuantity).toBe(5);

    // Trade routes
    expect(input.tradeRoutes).toHaveLength(1);
    const route = input.tradeRoutes[0];
    expect(route.id).toBe(TRADE_ROUTE_ID);
    expect(route.status).toBe("active");
    expect(route.quantityPerTransition).toBe(10);

    // Citizens (alive only)
    expect(input.citizens).toHaveLength(2);
    const citizen = input.citizens.find((c) => c.id === CITIZEN_ID);
    if (citizen === undefined)
      throw new Error(`citizen ${CITIZEN_ID} not found`);
    expect(citizen.name).toBe("Alice");
    expect(citizen.citizenType).toBe("npc");
    expect(citizen.bornOnTurnNumber).toBe(1);
    expect(citizen.parentACitizenId).toBeNull();

    // Citizen assignments
    expect(input.citizenAssignments).toHaveLength(1);
    const assignment = input.citizenAssignments[0];
    expect(assignment.citizenId).toBe(CITIZEN_ID);
    expect(assignment.assignmentType).toBe("standard_job");
    expect(assignment.jobId).toBe(JOB_ID);

    // Partnerships
    expect(input.partnerships).toHaveLength(1);
    const partnership = input.partnerships[0];
    expect(partnership.id).toBe(PARTNERSHIP_ID);
    expect(partnership.citizenAId).toBe(CITIZEN_ID);
    expect(partnership.citizenBId).toBe(PARTNER_ID);
    expect(partnership.status).toBe("active");

    // Events
    expect(input.events).toHaveLength(1);
    const event = input.events[0];
    expect(event.id).toBe(EVENT_ID);
    expect(event.effectType).toBe("resource_grant");
    expect(event.status).toBe("pending");
    expect(event.activateOnTransitionAfterTurnNumber).toBe(4);
  });

  it("returns a state_unavailable error when auth header is missing", async () => {
    stubSupabaseFetch({});

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      {
        userId: "user-1",
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error.code).toBe("end_turn_state_unavailable");
    expect(result.status).toBe(500);
  });

  it("returns a not_found error when the world row is missing", async () => {
    stubSupabaseFetch({
      "/rest/v1/worlds": { body: [], status: 200 },
      "/rest/v1/settlements": { body: [], status: 200 },
    });

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error.code).toBe("end_turn_world_not_found");
    expect(result.status).toBe(404);
  });

  it("returns a state_unavailable error when the world fetch fails with a network error", async () => {
    vi.stubGlobal("Deno", {
      env: {
        get: (name: string): string | undefined => {
          if (name === "SUPABASE_URL") return "http://localhost:54321";
          if (name === "SUPABASE_ANON_KEY") return "test-anon-key";
          return undefined;
        },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error"))),
    );

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error.code).toBe("end_turn_state_unavailable");
    expect(result.status).toBe(500);
  });

  it("returns an unauthorized error on a 403 response from the world fetch", async () => {
    stubSupabaseFetch({
      "/rest/v1/worlds": { body: { message: "Forbidden" }, status: 403 },
      "/rest/v1/settlements": { body: [], status: 200 },
    });

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error.code).toBe("unauthorized");
    expect(result.status).toBe(403);
  });

  it("returns a calendar_config_invalid error when the world has an invalid calendar config", async () => {
    const badWorld = {
      ...makeWorldRow(),
      calendar_config_json: { invalid: true },
    };
    stubSupabaseFetch({
      "/rest/v1/worlds": { body: [badWorld], status: 200 },
      "/rest/v1/settlements": {
        body: [
          {
            id: SETTLEMENT_ID,
            name: "S1",
            is_ready_current_turn: false,
            auto_ready_enabled: false,
            nations: {},
          },
        ],
        status: 200,
      },
    });

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.error.code).toBe("end_turn_calendar_config_invalid");
    expect(result.status).toBe(500);
  });

  it("sends is_trashed=eq.false in the resources query URL", async () => {
    const fetchMock = stubSupabaseFetch(makeAllSuccessResponses());

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(true);

    const resourcesUrl = (fetchMock.mock.calls as [string, ...unknown[]][])
      .map(([url]) => url)
      .find((url) => url.includes("/rest/v1/resources"));
    expect(resourcesUrl).toBeDefined();
    expect(resourcesUrl).toContain("is_trashed=eq.false");
  });

  it("sets isWorldArchived to true for an archived world", async () => {
    const archivedWorld = { ...makeWorldRow(), status: "archived" };
    const responses = makeAllSuccessResponses();
    responses["/rest/v1/worlds"] = { body: [archivedWorld], status: 200 };
    stubSupabaseFetch(responses);

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.isWorldArchived).toBe(true);
  });

  it("returns empty collections when no entities exist for the world", async () => {
    stubSupabaseFetch({
      "/rest/v1/worlds": { body: [makeWorldRow()], status: 200 },
      "/rest/v1/settlements": {
        body: [
          {
            id: SETTLEMENT_ID,
            name: "S1",
            is_ready_current_turn: false,
            auto_ready_enabled: false,
            nations: {},
          },
        ],
        status: 200,
      },
      "/rest/v1/resources": {
        body: [
          { id: FOOD_ID, slug: "food" },
          { id: WATER_ID, slug: "fresh-water" },
        ],
        status: 200,
      },
      "/rest/v1/settlement_stockpiles_view": { body: [], status: 200 },
      "/rest/v1/job_definitions": { body: [], status: 200 },
      "/rest/v1/building_blueprints": { body: [], status: 200 },
      "/rest/v1/settlement_buildings": { body: [], status: 200 },
      "/rest/v1/construction_projects": { body: [], status: 200 },
      "/rest/v1/deposit_types": { body: [], status: 200 },
      "/rest/v1/deposit_instances": { body: [], status: 200 },
      "/rest/v1/managed_population_types": { body: [], status: 200 },
      "/rest/v1/managed_population_instances": { body: [], status: 200 },
      "/rest/v1/trade_routes": { body: [], status: 200 },
      "/rest/v1/citizens": { body: [], status: 200 },
      "/rest/v1/events": { body: [], status: 200 },
      "/rest/v1/citizen_assignments": { body: [], status: 200 },
      "/rest/v1/partnerships": { body: [], status: 200 },
    });

    const result = await resolveSupabaseEndTurnSimulationInput(
      makeRequestBody(),
      makeAuthContext(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { input } = result;
    expect(input.settlements).toHaveLength(1);
    expect(input.jobs).toHaveLength(0);
    expect(input.buildingBlueprints).toHaveLength(0);
    expect(input.buildingTiers).toHaveLength(0);
    expect(input.citizenAssignments).toHaveLength(0);
    expect(input.citizens).toHaveLength(0);
    expect(input.deposits).toHaveLength(0);
    expect(input.events).toHaveLength(0);
    expect(input.managedPopulations).toHaveLength(0);
    expect(input.partnerships).toHaveLength(0);
    expect(input.tradeRoutes).toHaveLength(0);
  });
});
