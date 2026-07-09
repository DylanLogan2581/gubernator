// Re-exports the single source of truth at src/shared/military so the
// edge simulation and the browser UI can never drift on upkeep/desertion
// projection math (#1113).
export * from "../../../../src/shared/military/index.ts";
