// Re-exports the single source of truth at src/shared/seededRng so browser
// code and the edge simulation can never drift on PRNG determinism.
export * from "@/shared/seededRng";
