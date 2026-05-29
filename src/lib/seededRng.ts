// Deterministic PRNG helpers used in place of Math.random() — lint forbids
// Math.random in app code so that any randomness can be seeded for tests.
//
// `mulberry32` is a tiny, well-distributed 32-bit generator; `hashStringToSeed`
// turns an arbitrary string (e.g. a citizen id) into an integer seed.

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
