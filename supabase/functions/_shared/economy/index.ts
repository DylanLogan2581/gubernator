// Re-exports the single source of truth at src/shared/economy so the
// edge simulation and the browser UI can never drift on currency rules.
export * from "../../../../src/shared/economy/index.ts";
