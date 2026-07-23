/**
 * Minimum whole number of workers needed to fully cover `demand`, given the
 * per-worker rates of one or more linked jobs (husbandry: workersPerNAnimals,
 * culling: maxCullPerWorker).
 *
 * Mirrors the simulation's equal-share pooling across linked jobs of a type
 * (see phaseManagedPopulations.ts): workers split evenly, as a float, across
 * jobs, so aggregate capacity is `workers * mean(rates)`. Multiplying before
 * dividing (rather than averaging the rates first) avoids the floating-point
 * drift a two-step average/divide can introduce near integer boundaries.
 */
export function calculateNeededWorkers(
  demand: number,
  rates: readonly number[],
): number | null {
  if (rates.length === 0) return null;

  const totalRate = rates.reduce((sum, rate) => sum + rate, 0);
  if (totalRate <= 0) return null;
  if (demand <= 0) return 0;

  return Math.ceil((demand * rates.length) / totalRate);
}
