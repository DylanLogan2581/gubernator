// Sorting helpers for simulation phases.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

/** Three-way string comparator — returns −1, 0, or 1. */
export function compareById(a: { id: string }, b: { id: string }): -1 | 0 | 1 {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
