import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchAssignments,
  fetchBlueprints,
  fetchBuildings,
  fetchCitizens,
  fetchDeposits,
  fetchDepositTypes,
  fetchEducationEnrollments,
  fetchEvents,
  fetchJobs,
  fetchManagedPops,
  fetchManagedPopTypes,
  fetchNationCurrencies,
  fetchNationOffices,
  fetchNationTreaties,
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

  it("disambiguates the nations embed with an explicit FK hint", async () => {
    const { calls } = stubFetch([]);

    await fetchSettlements(ctx, WORLD_ID);

    const url = calls[0];
    expect(decodeURIComponent(url)).toContain(
      "nations!settlements_nation_id_fkey!inner(nameset_id,world_id)",
    );
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
    expect(url).toContain("order=settlement_id.asc%2Cresource_id.asc");
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
  it("filters by in-world settlement ids and status=in.(active,paused)", async () => {
    const { calls } = stubFetch([]);

    await fetchTradeRoutes(ctx, [SETTLEMENT_ID]);

    const url = calls[0];
    expect(url).toContain("/rest/v1/trade_routes");
    expect(url).toContain(`origin_settlement_id=in.%28${SETTLEMENT_ID}%29`);
    expect(url).toContain(
      `destination_settlement_id=in.%28${SETTLEMENT_ID}%29`,
    );
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

// ---------------------------------------------------------------------------
// Pagination tests
// ---------------------------------------------------------------------------

describe("pagination", () => {
  it("fetchCitizens paginates when response exceeds 1000 rows", async () => {
    // Simulate >1000 citizens: first page 1000, second page 500
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `citizen-${i}`,
      settlement_id: SETTLEMENT_ID,
      citizen_type: "settler",
      given_name: `Citizen`,
      surname: `${i}`,
      sex: "M",
      status: "alive",
      born_on_turn_number: 1,
      parent_a_citizen_id: null,
      parent_b_citizen_id: null,
    }));
    const page2 = Array.from({ length: 500 }, (_, i) => ({
      id: `citizen-${i + 1000}`,
      settlement_id: SETTLEMENT_ID,
      citizen_type: "settler",
      given_name: `Citizen`,
      surname: `${i + 1000}`,
      sex: "F",
      status: "alive",
      born_on_turn_number: 1,
      parent_a_citizen_id: null,
      parent_b_citizen_id: null,
    }));

    let callCount = 0;
    const fetchCalls: Array<{ url: string; rangeHeader?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (
          url: string,
          init?: { headers?: Record<string, string> },
        ): Promise<Response> => {
          fetchCalls.push({
            url,
            rangeHeader: init?.headers?.Range,
          });
          callCount++;

          if (callCount === 1) {
            // First page: 0-999 of 1500
            return Promise.resolve(
              new Response(JSON.stringify(page1), {
                status: 200,
                headers: {
                  "Content-Range": "0-999/*",
                },
              }),
            );
          } else if (callCount === 2) {
            // Second page: 1000-1499 of 1500
            return Promise.resolve(
              new Response(JSON.stringify(page2), {
                status: 200,
                headers: {
                  "Content-Range": "1000-1499/*",
                },
              }),
            );
          }
          return Promise.reject(new Error("Unexpected call"));
        },
      ),
    );

    const result = await fetchCitizens(ctx, WORLD_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1500);
      expect(fetchCalls).toHaveLength(2);
      // Bare `start-end` (default `items` range unit). A `rows=` prefix is
      // parsed by PostgREST as an unknown unit and ignored, which would return
      // the first page forever (infinite loop / OOM for >1 page of rows).
      expect(fetchCalls[0].rangeHeader).toBe("0-999");
      expect(fetchCalls[1].rangeHeader).toBe("1000-1999");
    }
  });

  it("fetchAssignments detects and reports truncation when no pagination headers", async () => {
    // Simulate a full page (1000 rows) returned with no Content-Range header.
    const page = Array.from({ length: 1000 }, (_, i) => ({
      citizen_id: `citizen-${i}`,
      assignment_type: "job",
      job_id: "job-1",
      construction_project_id: null,
      deposit_instance_id: null,
      managed_population_instance_id: null,
      trade_route_id: null,
      trade_route_end: null,
      assigned_on_turn_number: 1,
    }));

    vi.stubGlobal(
      "fetch",
      vi.fn((): Promise<Response> => {
        // Return a full page (1000 rows) with no Content-Range header. We cannot
        // rule out additional rows, so this must be reported as a truncation risk
        // rather than silently dropping data.
        return Promise.resolve(
          new Response(JSON.stringify(page), { status: 200 }),
        );
      }),
    );

    const result = await fetchAssignments(ctx, WORLD_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("response_truncated");
    }
  });

  it("fetchStockpiles accumulates rows across multiple pages", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      settlement_id: SETTLEMENT_ID,
      resource_id: `resource-${i % 10}`,
      quantity: 100,
      effective_cap: 1000,
    }));
    const page2 = Array.from({ length: 100 }, (_, i) => ({
      settlement_id: SETTLEMENT_ID,
      resource_id: `resource-${i % 10}`,
      quantity: 50,
      effective_cap: 500,
    }));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((): Promise<Response> => {
        callCount++;

        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(page1), {
              status: 200,
              headers: {
                "Content-Range": "0-999/*",
              },
            }),
          );
        } else if (callCount === 2) {
          return Promise.resolve(
            new Response(JSON.stringify(page2), {
              status: 200,
              headers: {
                "Content-Range": "1000-1099/*",
              },
            }),
          );
        }
        return Promise.reject(new Error("Unexpected call"));
      }),
    );

    const result = await fetchStockpiles(ctx, [SETTLEMENT_ID]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1100);
    }
  });


  it("fetchEducationEnrollments paginates when response exceeds 1000 rows", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `enrollment-${i}`,
      world_id: WORLD_ID,
      settlement_building_id: "building-1",
      citizen_id: `citizen-${i}`,
      target_level_id: "level-1",
      progress_turns: 0,
      enrolled_turn_number: 1,
    }));
    const page2 = Array.from({ length: 200 }, (_, i) => ({
      id: `enrollment-${i + 1000}`,
      world_id: WORLD_ID,
      settlement_building_id: "building-1",
      citizen_id: `citizen-${i + 1000}`,
      target_level_id: "level-1",
      progress_turns: 0,
      enrolled_turn_number: 1,
    }));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((): Promise<Response> => {
        callCount++;

        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(page1), {
              status: 200,
              headers: { "Content-Range": "0-999/*" },
            }),
          );
        } else if (callCount === 2) {
          return Promise.resolve(
            new Response(JSON.stringify(page2), {
              status: 200,
              headers: { "Content-Range": "1000-1199/*" },
            }),
          );
        }
        return Promise.reject(new Error("Unexpected call"));
      }),
    );

    const result = await fetchEducationEnrollments(ctx, WORLD_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1200);
    }
  });

  it("fetchNationOffices paginates when response exceeds 1000 rows", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      citizen_id: `citizen-${i}`,
      office_types: { excludes_from_labor: false },
    }));
    const page2 = Array.from({ length: 50 }, (_, i) => ({
      citizen_id: `citizen-${i + 1000}`,
      office_types: { excludes_from_labor: false },
    }));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((): Promise<Response> => {
        callCount++;

        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(page1), {
              status: 200,
              headers: { "Content-Range": "0-999/*" },
            }),
          );
        } else if (callCount === 2) {
          return Promise.resolve(
            new Response(JSON.stringify(page2), {
              status: 200,
              headers: { "Content-Range": "1000-1049/*" },
            }),
          );
        }
        return Promise.reject(new Error("Unexpected call"));
      }),
    );

    const result = await fetchNationOffices(ctx, WORLD_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1050);
    }
  });

  it("fetchNationTreaties paginates when response exceeds 1000 rows", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `treaty-${i}`,
      proposer_nation_id: "nation-1",
      responder_nation_id: "nation-2",
      treaty_type: "trade",
      terms: {},
      ends_turn_number: null,
    }));
    const page2 = Array.from({ length: 25 }, (_, i) => ({
      id: `treaty-${i + 1000}`,
      proposer_nation_id: "nation-1",
      responder_nation_id: "nation-2",
      treaty_type: "trade",
      terms: {},
      ends_turn_number: null,
    }));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((): Promise<Response> => {
        callCount++;

        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(page1), {
              status: 200,
              headers: { "Content-Range": "0-999/*" },
            }),
          );
        } else if (callCount === 2) {
          return Promise.resolve(
            new Response(JSON.stringify(page2), {
              status: 200,
              headers: { "Content-Range": "1000-1024/*" },
            }),
          );
        }
        return Promise.reject(new Error("Unexpected call"));
      }),
    );

    const result = await fetchNationTreaties(ctx, WORLD_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1025);
    }
  });

  it("fetchNationCurrencies paginates when response exceeds 1000 rows", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `currency-${i}`,
      nation_id: "nation-1",
      name: "gold",
      currency_type: "commodity",
      backing_resource_id: null,
      backing_ratio: null,
      money_supply: 0,
      reserve_quantity: 0,
      confidence: 1,
      is_in_default: false,
    }));
    const page2 = Array.from({ length: 10 }, (_, i) => ({
      id: `currency-${i + 1000}`,
      nation_id: "nation-1",
      name: "gold",
      currency_type: "commodity",
      backing_resource_id: null,
      backing_ratio: null,
      money_supply: 0,
      reserve_quantity: 0,
      confidence: 1,
      is_in_default: false,
    }));

    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((): Promise<Response> => {
        callCount++;

        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify(page1), {
              status: 200,
              headers: { "Content-Range": "0-999/*" },
            }),
          );
        } else if (callCount === 2) {
          return Promise.resolve(
            new Response(JSON.stringify(page2), {
              status: 200,
              headers: { "Content-Range": "1000-1009/*" },
            }),
          );
        }
        return Promise.reject(new Error("Unexpected call"));
      }),
    );

    const result = await fetchNationCurrencies(ctx, WORLD_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1010);
    }
  });
});

// ---------------------------------------------------------------------------
// Concurrent pagination (#1280)
// ---------------------------------------------------------------------------

type PagedServer = {
  readonly maxInFlight: () => number;
  readonly rangeHeaders: string[];
  readonly requestedCount: boolean[];
};

/**
 * Stub a PostgREST-like server over `rows` that honours the `Range` header and
 * reports an exact total when `Prefer: count=exact` is sent. Resolves each page
 * on a later microtask so overlapping requests are observable.
 */
function stubPagedServer(
  rows: readonly unknown[],
  { exactCount = true }: { exactCount?: boolean } = {},
): PagedServer {
  const rangeHeaders: string[] = [];
  const requestedCount: boolean[] = [];
  let inFlight = 0;
  let peakInFlight = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (
        _url: string,
        init?: { headers?: Record<string, string> },
      ): Promise<Response> => {
        const rangeHeader = init?.headers?.Range ?? "0-999";
        rangeHeaders.push(rangeHeader);
        requestedCount.push(init?.headers?.Prefer === "count=exact");

        inFlight += 1;
        peakInFlight = Math.max(peakInFlight, inFlight);
        // Yield twice so concurrently-issued pages overlap here.
        await Promise.resolve();
        await Promise.resolve();
        inFlight -= 1;

        const [startRaw, endRaw] = rangeHeader.split("-");
        const start = parseInt(startRaw, 10);
        const end = parseInt(endRaw, 10);
        const page = rows.slice(start, end + 1);
        const total = exactCount ? String(rows.length) : "*";

        return new Response(JSON.stringify(page), {
          status: 200,
          headers: {
            "Content-Range": `${start}-${start + Math.max(page.length - 1, 0)}/${total}`,
          },
        });
      },
    ),
  );

  return { maxInFlight: () => peakInFlight, rangeHeaders, requestedCount };
}

function makeCitizens(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `citizen-${String(i).padStart(6, "0")}`,
    settlement_id: SETTLEMENT_ID,
    citizen_type: "settler",
    given_name: "Citizen",
    surname: String(i),
    sex: i % 2 === 0 ? "M" : "F",
    status: "alive",
    born_on_turn_number: 1,
    parent_a_citizen_id: null,
    parent_b_citizen_id: null,
  }));
}

describe("concurrent pagination", () => {
  it("loads the same rows in the same order as the sequential walk", async () => {
    const citizens = makeCitizens(7_321);

    const sequential = await (async () => {
      stubPagedServer(citizens, { exactCount: false });
      return fetchCitizens(ctx, WORLD_ID);
    })();
    vi.unstubAllGlobals();

    const server = stubPagedServer(citizens, { exactCount: true });
    const concurrent = await fetchCitizens(ctx, WORLD_ID);

    expect(sequential.ok).toBe(true);
    expect(concurrent.ok).toBe(true);
    if (sequential.ok && concurrent.ok) {
      expect(concurrent.rows).toHaveLength(citizens.length);
      expect(concurrent.rows).toEqual(sequential.rows);
    }

    // 8 pages: the count probe plus 7 fanned-out pages.
    expect(server.rangeHeaders).toHaveLength(8);
    expect(server.maxInFlight()).toBeGreaterThan(1);
  });

  it("requests the exact count only on the probe page", async () => {
    const server = stubPagedServer(makeCitizens(3_500));

    await fetchCitizens(ctx, WORLD_ID);

    expect(server.requestedCount[0]).toBe(true);
    expect(server.requestedCount.slice(1)).toEqual([false, false, false]);
    expect(server.rangeHeaders).toEqual([
      "0-999",
      "1000-1999",
      "2000-2999",
      "3000-3999",
    ]);
  });

  it("bounds how many page requests are in flight at once", async () => {
    const server = stubPagedServer(makeCitizens(40_000));

    const result = await fetchCitizens(ctx, WORLD_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(40_000);
    }
    expect(server.maxInFlight()).toBeLessThanOrEqual(6);
  });

  it("keeps walking when rows are appended after the count was taken", async () => {
    const citizens = makeCitizens(2_500);
    let served = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (
          _url: string,
          init?: { headers?: Record<string, string> },
        ): Promise<Response> => {
          const rangeHeader = init?.headers?.Range ?? "0-999";
          const [startRaw, endRaw] = rangeHeader.split("-");
          const start = parseInt(startRaw, 10);
          const end = parseInt(endRaw, 10);
          served += 1;

          // The probe reports a stale total of 2000 while the table really
          // holds 2500 rows, so the "final" planned page comes back full.
          const total = served === 1 ? "2000" : "*";
          const page = citizens.slice(start, end + 1);

          return Promise.resolve(
            new Response(JSON.stringify(page), {
              status: 200,
              headers: {
                "Content-Range": `${start}-${start + Math.max(page.length - 1, 0)}/${total}`,
              },
            }),
          );
        },
      ),
    );

    const result = await fetchCitizens(ctx, WORLD_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(2_500);
      expect(result.rows).toEqual(citizens);
    }
  });

  it("propagates an http error from a fanned-out page", async () => {
    const citizens = makeCitizens(3_000);

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (
          _url: string,
          init?: { headers?: Record<string, string> },
        ): Promise<Response> => {
          const rangeHeader = init?.headers?.Range ?? "0-999";
          const start = parseInt(rangeHeader.split("-")[0], 10);

          if (start === 2000) {
            return Promise.resolve(new Response("boom", { status: 500 }));
          }

          const page = citizens.slice(start, start + 1000);

          return Promise.resolve(
            new Response(JSON.stringify(page), {
              status: 200,
              headers: {
                "Content-Range": `${start}-${start + page.length - 1}/3000`,
              },
            }),
          );
        },
      ),
    );

    const result = await fetchCitizens(ctx, WORLD_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toEqual({ kind: "http_error", safeDeny: false });
    }
  });
});
