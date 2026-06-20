/**
 * Canonical list of env var names required by edge functions.
 *
 * EDGE_COMMON_ENV_VAR_NAMES: required by every edge function.
 * EDGE_SERVICE_ROLE_ENV_VAR_NAMES: required only by functions that make
 * admin API calls (bypasses RLS via service-role key).
 *
 * Each edge function's entry point validates its required set at cold start
 * via assertEdgeEnvVars from _shared/http/env.ts.
 */

export const EDGE_COMMON_ENV_VAR_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
] as const;

export type EdgeCommonEnvVarName = (typeof EDGE_COMMON_ENV_VAR_NAMES)[number];

export const EDGE_SERVICE_ROLE_ENV_VAR_NAMES = ["SUPABASE_SERVICE_ROLE_KEY"] as const;

export type EdgeServiceRoleEnvVarName = (typeof EDGE_SERVICE_ROLE_ENV_VAR_NAMES)[number];
