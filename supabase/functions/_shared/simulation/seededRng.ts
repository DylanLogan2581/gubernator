// Re-exports the single source of truth at src/shared/seededRng so the edge
// simulation and the browser client can never drift on PRNG determinism.
export * from "../../../../src/shared/seededRng.ts";
