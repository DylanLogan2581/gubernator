// Micro-benchmark: sequential Range-walking (100 serial round-trips at 100k
// citizens) versus the bounded-concurrency fan-out enabled by the exact-count
// probe. Each page response is delayed to stand in for network latency, so the
// numbers approximate wall-clock load time rather than CPU time.
//
// Not part of the test suite — run with:
//   npx vitest bench supabase/functions/end-turn-simulation/state/pagination.bench.ts

import { bench, describe } from "vitest";

import { fetchCitizens } from "./queries.ts";

const CITIZEN_COUNT = 100_000;
const PAGE_SIZE = 1000;
const PAGE_LATENCY_MS = 5;

const ctx = {
  headers: { apikey: "bench-key", authorization: "Bearer bench-token" },
  supabaseUrl: "http://localhost:54321",
};

const rows = Array.from({ length: CITIZEN_COUNT }, (_, i) => ({
  id: `citizen-${String(i).padStart(6, "0")}`,
  settlement_id: `settlement-${i % 50}`,
  citizen_type: "npc",
  given_name: "Citizen",
  surname: String(i),
  sex: i % 2 === 0 ? "M" : "F",
  status: "alive",
  born_on_turn_number: i % 40,
  parent_a_citizen_id: null,
  parent_b_citizen_id: null,
}));

// Pre-serialise every page once: the benchmark measures round-trip overlap, not
// JSON encoding.
const pageBodies = Array.from(
  { length: Math.ceil(CITIZEN_COUNT / PAGE_SIZE) },
  (_, page) =>
    JSON.stringify(rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)),
);

function installStubFetch(exactCount: boolean): void {
  globalThis.fetch = ((
    _url: string,
    init?: { headers?: Record<string, string> },
  ): Promise<Response> => {
    const rangeHeader = init?.headers?.Range ?? "0-999";
    const start = parseInt(rangeHeader.split("-")[0], 10);
    const page = start / PAGE_SIZE;
    const body = pageBodies[page] ?? "[]";
    const rowCount = page < pageBodies.length ? PAGE_SIZE : 0;
    const total = exactCount ? String(CITIZEN_COUNT) : "*";

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          new Response(body, {
            status: 200,
            headers: {
              "Content-Range": `${start}-${start + Math.max(rowCount - 1, 0)}/${total}`,
            },
          }),
        );
      }, PAGE_LATENCY_MS);
    });
  }) as typeof fetch;
}

describe(`${CITIZEN_COUNT} citizens, ${PAGE_LATENCY_MS}ms per page`, () => {
  bench("sequential range-walk (before)", async () => {
    // An unknown total (`*`) forces the sequential tail walk, which is exactly
    // the pre-#1280 behaviour.
    installStubFetch(false);
    await fetchCitizens(ctx, "00000000-0000-0000-0000-000000000001");
  });

  bench("bounded concurrent pages (after)", async () => {
    installStubFetch(true);
    await fetchCitizens(ctx, "00000000-0000-0000-0000-000000000001");
  });
});
