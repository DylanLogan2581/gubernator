import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchAssignments,
  fetchBlueprints,
  fetchBuildings,
  fetchCitizens,
  fetchDeposits,
  fetchDepositTypes,
  fetchEvents,
  fetchJobs,
  fetchManagedPops,
  fetchManagedPopTypes,
  fetchPartnerships,
  fetchProjects,
  fetchResources,
  fetchSettlements,
  fetchStockpiles,
  fetchTradeRoutes,
  fetchWorldRow,
} from "./queries";

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const WORLD_ID = "00000000-0000-0000-0000-000000000001";
const SETTLEMENT_ID = "00000000-0000-0000-0000-000000000002";
const SUPABASE_URL = "http://localhost:54321";

const ctx = {
  headers: { apikey: "test-key", authorization: "Bearer test-token" },
  supabaseUrl: SUPABASE_URL,
};

function stubFetch(body: unknown = []): { calls: string[] } {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string): Promise<Response> => {
      calls.push(url);
      return Promise.resolve(
        new Response(JSON.stringify(body), { status: 200 }),
      );
    }),
  );
  return { calls };
}

// ---------------------------------------------------------------------------
// fetchWorldRow
// ---------------------------------------------------------------------------

describe("fetchWorldRow", () => {
  it("sends world_id=eq.<uuid> and a limit=1 in the URL", async () => {
    const worldRow = {
      id: WORLD_ID,
      status: "active",
      current_turn_number: 1,
      calendar_config_json: null,
      npc_flavor_config_json: null,
      partnership_seek_chance: 0.3,
      fertility_chance: 0.1,
      minimum_partnership_age_turns: 18,
      maximum_fertility_age_turns: null,
      mourning_period_turns: 3,
      homelessness_decline_rate: 0.2,
      starvation_severity_multiplier: 1.0,
      food_consumption_per_citizen: 1.0,
      water_consumption_per_citizen: 1.0,
      incest_prevention_depth: 4,
    };
    const { calls } = stubFetch([worldRow]);

    await fetchWorldRow(ctx, WORLD_ID);

    expect(calls).toHaveLength(1);
    const url = calls[0];
    expect(url).toContain(`/rest/v1/worlds`);
    expect(url).toContain(`id=eq.${WORLD_ID}`);
    expect(url).toContain("limit=1");
  });
});

// ---------------------------------------------------------------------------
// fetchSettlements
// ---------------------------------------------------------------------------

describe("fetchSettlements", () => {
  it("filters by nations.world_id=eq.<uuid>", async () => {
    const { calls } = stubFetch([]);

    await fetchSettlements(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/settlements");
    expect(url).toContain(`nations.world_id=eq.${WORLD_ID}`);
  });
});

// ---------------------------------------------------------------------------
// fetchResources
// ---------------------------------------------------------------------------

describe("fetchResources", () => {
  it("sends is_trashed=eq.false and world_id=eq.<uuid> in the URL", async () => {
    const { calls } = stubFetch([]);

    await fetchResources(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/resources");
    expect(url).toContain(`world_id=eq.${WORLD_ID}`);
    expect(url).toContain("is_trashed=eq.false");
    expect(url).toContain("is_system_resource=eq.true");
  });
});

// ---------------------------------------------------------------------------
// fetchJobs
// ---------------------------------------------------------------------------

describe("fetchJobs", () => {
  it("sends is_trashed=eq.false and world_id=eq.<uuid> in the URL", async () => {
    const { calls } = stubFetch([]);

    await fetchJobs(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/job_definitions");
    expect(url).toContain(`world_id=eq.${WORLD_ID}`);
    expect(url).toContain("is_trashed=eq.false");
  });
});

// ---------------------------------------------------------------------------
// fetchBlueprints
// ---------------------------------------------------------------------------

describe("fetchBlueprints", () => {
  it("sends is_trashed=eq.false and world_id=eq.<uuid> in the URL", async () => {
    const { calls } = stubFetch([]);

    await fetchBlueprints(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/building_blueprints");
    expect(url).toContain(`world_id=eq.${WORLD_ID}`);
    expect(url).toContain("is_trashed=eq.false");
  });
});

// ---------------------------------------------------------------------------
// fetchStockpiles
// ---------------------------------------------------------------------------

describe("fetchStockpiles", () => {
  it("filters by settlement_id in-list", async () => {
    const { calls } = stubFetch([]);

    await fetchStockpiles(ctx, [SETTLEMENT_ID]);

    const url = calls[0];
    expect(url).toContain("/rest/v1/settlement_stockpiles_view");
    expect(url).toContain(`settlement_id=in.%28${SETTLEMENT_ID}%29`);
  });

  it("uses an empty in-list when no settlement ids are given", async () => {
    const { calls } = stubFetch([]);

    await fetchStockpiles(ctx, []);

    expect(calls[0]).toContain("settlement_id=in.%28%29");
  });
});

// ---------------------------------------------------------------------------
// fetchBuildings
// ---------------------------------------------------------------------------

describe("fetchBuildings", () => {
  it("filters by settlement_id and state=in.(active,suspended)", async () => {
    const { calls } = stubFetch([]);

    await fetchBuildings(ctx, [SETTLEMENT_ID]);

    const url = calls[0];
    expect(url).toContain("/rest/v1/settlement_buildings");
    expect(url).toContain(`settlement_id=in.%28${SETTLEMENT_ID}%29`);
    expect(url).toContain("state=in.");
    expect(url).toContain("active");
    expect(url).toContain("suspended");
  });
});

// ---------------------------------------------------------------------------
// fetchProjects
// ---------------------------------------------------------------------------

describe("fetchProjects", () => {
  it("filters by settlement_id and status=in.(in_progress,queued,paused)", async () => {
    const { calls } = stubFetch([]);

    await fetchProjects(ctx, [SETTLEMENT_ID]);

    const url = calls[0];
    expect(url).toContain("/rest/v1/construction_projects");
    expect(url).toContain(`settlement_id=in.%28${SETTLEMENT_ID}%29`);
    expect(url).toContain("status=in.");
    expect(url).toContain("in_progress");
    expect(url).toContain("queued");
    expect(url).toContain("paused");
  });
});

// ---------------------------------------------------------------------------
// fetchDepositTypes
// ---------------------------------------------------------------------------

describe("fetchDepositTypes", () => {
  it("sends is_trashed=eq.false and world_id=eq.<uuid> in the URL", async () => {
    const { calls } = stubFetch([]);

    await fetchDepositTypes(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/deposit_types");
    expect(url).toContain(`world_id=eq.${WORLD_ID}`);
    expect(url).toContain("is_trashed=eq.false");
  });
});

// ---------------------------------------------------------------------------
// fetchDeposits
// ---------------------------------------------------------------------------

describe("fetchDeposits", () => {
  it("filters by settlement_id and status=eq.active", async () => {
    const { calls } = stubFetch([]);

    await fetchDeposits(ctx, [SETTLEMENT_ID]);

    const url = calls[0];
    expect(url).toContain("/rest/v1/deposit_instances");
    expect(url).toContain(`settlement_id=in.%28${SETTLEMENT_ID}%29`);
    expect(url).toContain("status=eq.active");
  });
});

// ---------------------------------------------------------------------------
// fetchManagedPopTypes
// ---------------------------------------------------------------------------

describe("fetchManagedPopTypes", () => {
  it("sends is_trashed=eq.false and world_id=eq.<uuid> in the URL", async () => {
    const { calls } = stubFetch([]);

    await fetchManagedPopTypes(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/managed_population_types");
    expect(url).toContain(`world_id=eq.${WORLD_ID}`);
    expect(url).toContain("is_trashed=eq.false");
  });
});

// ---------------------------------------------------------------------------
// fetchManagedPops
// ---------------------------------------------------------------------------

describe("fetchManagedPops", () => {
  it("filters by settlement_id and status=eq.active", async () => {
    const { calls } = stubFetch([]);

    await fetchManagedPops(ctx, [SETTLEMENT_ID]);

    const url = calls[0];
    expect(url).toContain("/rest/v1/managed_population_instances");
    expect(url).toContain(`settlement_id=in.%28${SETTLEMENT_ID}%29`);
    expect(url).toContain("status=eq.active");
  });
});

// ---------------------------------------------------------------------------
// fetchTradeRoutes
// ---------------------------------------------------------------------------

describe("fetchTradeRoutes", () => {
  it("filters by world_id and status=in.(active,paused)", async () => {
    const { calls } = stubFetch([]);

    await fetchTradeRoutes(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/trade_routes");
    expect(url).toContain(`origin_settlement_id-%3Eworld_id=eq.${WORLD_ID}`);
    expect(url).toContain("status=in.");
    expect(url).toContain("active");
    expect(url).toContain("paused");
  });
});

// ---------------------------------------------------------------------------
// fetchCitizens
// ---------------------------------------------------------------------------

describe("fetchCitizens", () => {
  it("filters by world_id=eq.<uuid> and status=eq.alive", async () => {
    const { calls } = stubFetch([]);

    await fetchCitizens(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/citizens");
    expect(url).toContain(`world_id=eq.${WORLD_ID}`);
    expect(url).toContain("status=eq.alive");
  });
});

// ---------------------------------------------------------------------------
// fetchEvents
// ---------------------------------------------------------------------------

describe("fetchEvents", () => {
  it("filters by world_id=eq.<uuid> and status=in.(active,pending)", async () => {
    const { calls } = stubFetch([]);

    await fetchEvents(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/events");
    expect(url).toContain(`world_id=eq.${WORLD_ID}`);
    expect(url).toContain("status=in.");
    expect(url).toContain("active");
    expect(url).toContain("pending");
  });
});

// ---------------------------------------------------------------------------
// fetchAssignments
// ---------------------------------------------------------------------------

describe("fetchAssignments", () => {
  it("filters via citizens.world_id=eq.<uuid> using an inner join", async () => {
    const { calls } = stubFetch([]);

    await fetchAssignments(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/citizen_assignments");
    expect(url).toContain(`citizens.world_id=eq.${WORLD_ID}`);
  });
});

// ---------------------------------------------------------------------------
// fetchPartnerships
// ---------------------------------------------------------------------------

describe("fetchPartnerships", () => {
  it("filters via citizen_a.world_id=eq.<uuid> using an aliased inner join", async () => {
    const { calls } = stubFetch([]);

    await fetchPartnerships(ctx, WORLD_ID);

    const url = calls[0];
    expect(url).toContain("/rest/v1/partnerships");
    expect(url).toContain(`citizen_a.world_id=eq.${WORLD_ID}`);
  });
});
