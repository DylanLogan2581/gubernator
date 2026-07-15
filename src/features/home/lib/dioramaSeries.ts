export type DioramaTick = {
  readonly tick: number;
  readonly population: number;
  readonly stockpile: number;
  readonly event: string | null;
};

const TICK_COUNT = 20;
const BASE_POPULATION = 42;
const POPULATION_STEP = 3;
const BASE_STOCKPILE = 60;
const STOCKPILE_TREND = 4;
const STOCKPILE_WAVE_AMPLITUDE = 18;

// Fixed ticks at which the landing-page diorama shows an event badge. Kept as
// a lookup so the series stays a pure function of `tick` — no render-time RNG.
const EVENT_BY_TICK: ReadonlyMap<number, string> = new Map([
  [4, "Harvest festival"],
  [12, "Trade route established"],
]);

function buildDioramaSeries(): readonly DioramaTick[] {
  const ticks: DioramaTick[] = [];
  for (let tick = 0; tick < TICK_COUNT; tick += 1) {
    const population = BASE_POPULATION + tick * POPULATION_STEP;
    const stockpile =
      BASE_STOCKPILE +
      tick * STOCKPILE_TREND +
      Math.round(STOCKPILE_WAVE_AMPLITUDE * Math.sin(tick / 2));
    ticks.push({
      tick,
      population,
      stockpile,
      event: EVENT_BY_TICK.get(tick) ?? null,
    });
  }
  return ticks;
}

export const DIORAMA_TICK_INTERVAL_MS = 1600;

// Start partway through the series so the first paint already shows a
// meaningful chart trend instead of a single point.
export const DIORAMA_INITIAL_TICK_INDEX = 3;

// Precomputed once at module load, not per render: every visitor sees the
// same deterministic sequence of fake turns.
export const DIORAMA_SERIES: readonly DioramaTick[] = buildDioramaSeries();
