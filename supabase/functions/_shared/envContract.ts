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

/**
 * Required by send-email: reuses the same SMTP credentials Supabase Auth
 * uses for magic-link/invite mail, re-exposed to the Edge Function under a
 * SEND_EMAIL_ prefix (Supabase CLI edge runtime secrets may not start with
 * "SUPABASE_" -- see supabase/config.toml's [edge_runtime.secrets]).
 * SEND_EMAIL_SMTP_USER and SEND_EMAIL_SMTP_PASS are intentionally excluded
 * here -- they are optional (empty for unauthenticated local Inbucket
 * delivery).
 */
export const EDGE_SEND_EMAIL_ENV_VAR_NAMES = [
  "SEND_EMAIL_SMTP_HOST",
  "SEND_EMAIL_SMTP_PORT",
  "SEND_EMAIL_SMTP_ADMIN_EMAIL",
  "SEND_EMAIL_SMTP_SENDER_NAME",
] as const;

export type EdgeSendEmailEnvVarName = (typeof EDGE_SEND_EMAIL_ENV_VAR_NAMES)[number];
