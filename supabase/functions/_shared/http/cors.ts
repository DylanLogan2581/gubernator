import { getRequiredRuntimeEnv } from "./env.ts";

export const corsBaseHeaders = {
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-max-age": "86400",
} as const;

export function parseAllowedOrigins(envVarName: string): readonly string[] {
  const value = getRequiredRuntimeEnv(envVarName);
  if (value === undefined) return [];
  return value
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function buildCorsHeaders(
  allowedOrigin: string | null,
): Record<string, string> {
  if (allowedOrigin === null) {
    return { ...corsBaseHeaders };
  }
  return {
    ...corsBaseHeaders,
    "access-control-allow-origin": allowedOrigin,
  };
}
