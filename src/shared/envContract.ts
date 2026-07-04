/**
 * Canonical list of env var names required by the browser (client) runtime.
 *
 * All names must be VITE_-prefixed so Vite includes them in the bundle.
 * Add new client-side vars here — the client validation in supabaseConfig
 * derives from this list.
 */
export const CLIENT_ENV_VAR_NAMES = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

export type ClientEnvVarName = (typeof CLIENT_ENV_VAR_NAMES)[number];

/**
 * Env var names that are server-only secrets and must never appear
 * in the VITE_ namespace or be reachable from browser code.
 *
 * Used by tests to assert the client bundle cannot contain these values.
 */
export const SERVER_SECRET_ENV_VAR_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type ServerSecretEnvVarName =
  (typeof SERVER_SECRET_ENV_VAR_NAMES)[number];
