// Seeded pseudo-random number generator — filled by #B10.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export type SeededRng = {
  next: () => number;
};

export function createSeededRng(seed: number): SeededRng {
  let state = seed;

  return {
    next(): number {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    },
  };
}
