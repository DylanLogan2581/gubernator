import { describe, expect, it } from "vitest";

import { calculateNeededWorkers } from "./calculateNeededWorkers";

describe("calculateNeededWorkers", () => {
  it("returns null when there are no linked jobs", () => {
    expect(calculateNeededWorkers(100, [])).toBeNull();
  });

  it("returns null when the total rate is zero", () => {
    expect(calculateNeededWorkers(100, [0, 0])).toBeNull();
  });

  it("returns 0 when demand is zero or negative", () => {
    expect(calculateNeededWorkers(0, [10])).toBe(0);
    expect(calculateNeededWorkers(-5, [10])).toBe(0);
  });

  it("computes the ceiling of demand / rate for a single job", () => {
    expect(calculateNeededWorkers(100, [10])).toBe(10);
    expect(calculateNeededWorkers(101, [10])).toBe(11);
    expect(calculateNeededWorkers(1, [10])).toBe(1);
  });

  it("pools multiple linked jobs by their combined rate", () => {
    // workers split evenly across 2 jobs, so total capacity per worker is
    // the mean rate (5); 100 demand needs 20 workers at that mean rate.
    expect(calculateNeededWorkers(100, [4, 6])).toBe(20);
  });

  it("avoids average/divide rounding drift at integer boundaries", () => {
    // averaging first: mean = 10/3 = 3.333...; 10 / 3.333... rounds up to 4
    // due to float drift, even though 3 workers exactly cover demand 10 when
    // pooled across rates [3, 3, 4] (total rate 10).
    expect(calculateNeededWorkers(10, [3, 3, 4])).toBe(3);
  });

  it("rounds up when demand exceeds an exact multiple", () => {
    expect(calculateNeededWorkers(11, [3, 3, 4])).toBe(4);
  });
});
