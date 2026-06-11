// Seeded pseudo-random number generator — cross-runtime (no browser APIs, no @/ alias).
//
// Mulberry32 is a tiny, well-distributed 32-bit generator; hashStringToSeed
// turns an arbitrary string (e.g. a turn_transition_id UUID) into an integer seed.

export type SeededRng = () => number;

export function mulberry32(seed: number): SeededRng {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(input: string): number {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: number | string): SeededRng {
  const numericSeed =
    typeof seed === "string" ? hashStringToSeed(seed) : seed >>> 0;
  return mulberry32(numericSeed);
}

export function pickDeterministic<T>(
  rng: SeededRng,
  items: readonly T[],
  count: number,
): readonly T[] {
  if (count > items.length) {
    throw new RangeError(
      `pickDeterministic: count (${count}) exceeds items.length (${items.length})`,
    );
  }
  const pool = items.slice();
  const result: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const remaining = pool.length - index;
    const swapIndex = index + Math.floor(rng() * remaining);
    const temp = pool[index];
    pool[index] = pool[swapIndex];
    pool[swapIndex] = temp;
    result.push(pool[index]);
  }
  return result;
}
