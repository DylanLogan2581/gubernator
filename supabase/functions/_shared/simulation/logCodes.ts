// Re-exports the single source of truth at src/shared/simulation/logCodes so the
// edge simulation phases and the browser client can never drift on log-category
// codes.
export * from "../../../../src/shared/simulation/logCodes.ts";
