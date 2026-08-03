import {
  EDGE_COMMON_ENV_VAR_NAMES,
  EDGE_SERVICE_ROLE_ENV_VAR_NAMES,
} from "../_shared/envContract.ts";
import { buildCorsHeaders, parseAllowedOrigins } from "../_shared/http/cors.ts";
import {
  assertEdgeEnvVars,
  getEdgeRuntime,
  getRequiredRuntimeEnv,
  getRequiredRuntimeUrl,
} from "../_shared/http/env.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/http/rateLimit.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/http/response.ts";
import { getAuthorizationHeader, resolveAuthContext } from "../_shared/http/session.ts";
import { supabaseFetch } from "../_shared/supabaseFetch.ts";

import { assembleWorldTemplate } from "./assemble.ts";
import { fetchWorldConfigData } from "./query.ts";
import { parseExportWorldTemplateRequestBody } from "./validate.ts";

function getAllowedOrigins(): readonly string[] {
  return parseAllowedOrigins("EXPORT_WORLD_TEMPLATE_ALLOWED_ORIGINS");
}

type BooleanRpcResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false };

async function fetchRpcBoolean(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  functionName: string,
  body: Record<string, unknown>,
): Promise<BooleanRpcResult> {
  let response: Response;
  try {
    response = await supabaseFetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      body: JSON.stringify(body),
      headers: {
        apikey: supabaseAnonKey,
        authorization: authorizationHeader,
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return { ok: false };
  }
  if (!response.ok) return { ok: false };
  const payload: unknown = await response.json();
  if (typeof payload !== "boolean") return { ok: false };
  return { ok: true, value: payload };
}

async function isAuthorized(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authorizationHeader: string,
  worldId: string,
): Promise<boolean | null> {
  // Check super-admin first; if that fails to fetch, short-circuit.
  const superAdminResult = await fetchRpcBoolean(
    supabaseUrl,
    supabaseAnonKey,
    authorizationHeader,
    "is_super_admin",
    {},
  );
  if (!superAdminResult.ok) return null;
  if (superAdminResult.value) return true;

  // Fall back to world-admin check.
  const worldAdminResult = await fetchRpcBoolean(
    supabaseUrl,
    supabaseAnonKey,
    authorizationHeader,
    "is_world_admin",
    { p_world_id: worldId },
  );
  if (!worldAdminResult.ok) return null;
  return worldAdminResult.value;
}

export async function handleExportWorldTemplateRequest(
  request: Request,
  options: { readonly allowedOrigins?: readonly string[] } = {},
): Promise<Response> {
  const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
  const origin = request.headers.get("origin");

  // CORS allowlist is enforced for browser requests (those with an Origin header).
  // Requests without the Origin header (non-browser clients, scripts, servers)
  // bypass this check and proceed to the JWT + world-admin/super-admin checks,
  // which are the actual access boundary.
  if (origin !== null && !allowedOrigins.includes(origin)) {
    return createJsonResponse(
      createErrorResponse({
        code: "origin_not_allowed",
        message: "Origin not allowed.",
      }),
      403,
      null,
    );
  }

  const allowedOrigin = origin;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: buildCorsHeaders(allowedOrigin),
      status: 204,
    });
  }

  const respond = (body: unknown, status: number): Response =>
    createJsonResponse(body, status, allowedOrigin);

  if (request.method !== "POST") {
    return respond(
      createErrorResponse({ code: "method_not_allowed", message: "Use POST." }),
      405,
    );
  }

  // Auth: extract JWT. Checked before the body is read (cheap, no network
  // round-trip) so an unauthenticated caller is rejected before anything is
  // buffered.
  const authorizationHeader = getAuthorizationHeader(request);
  if (authorizationHeader === null) {
    return respond(
      createErrorResponse({ code: "unauthenticated", message: "Authentication required." }),
      401,
    );
  }

  const validateResult = await parseExportWorldTemplateRequestBody(request);
  if (!validateResult.ok) {
    return respond(validateResult.error, validateResult.status);
  }

  const worldId = validateResult.body.worldId;

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return respond(
      createErrorResponse({
        code: "configuration_error",
        message: "Supabase configuration unavailable.",
      }),
      500,
    );
  }

  // Resolve the caller's user id for rate limiting, the same /auth/v1/user
  // lookup end-turn-simulation and admin-create-user use for their buckets.
  const authContextResult = await resolveAuthContext<{ readonly userId: string }>(
    request,
    {
      fetchFn: fetch,
      supabaseUrl,
      supabaseAnonKey,
      onAuthError: () => ({
        ok: false,
        error: createErrorResponse({
          code: "unauthenticated",
          message: "Authentication required.",
        }),
        status: 401,
      }),
      onSuccess: (context) => ({ ok: true, context }),
    },
  );

  if (!authContextResult.ok) {
    return respond(authContextResult.error, authContextResult.status);
  }

  // Rate limit: this endpoint fans out into a 12-table parallel export
  // (fetchWorldConfigData), so cap per-user calls before doing any of that
  // work or the authorization RPC round-trips below.
  const rateLimitResult = await checkRateLimit(
    authContextResult.context.userId,
    "export-world-template",
    RATE_LIMITS["export-world-template"],
  );
  if (!rateLimitResult.ok) {
    const body = createErrorResponse({
      code: "rate_limit_exceeded",
      message: "Too many requests. Please wait before retrying.",
    });
    const res = respond(body, 429);
    const headers = new Headers(res.headers);
    headers.set("retry-after", String(rateLimitResult.retryAfterSeconds));
    return new Response(res.body, { headers, status: 429 });
  }

  // Authz: must be world admin or super admin
  const authorized = await isAuthorized(
    supabaseUrl,
    supabaseAnonKey,
    authorizationHeader,
    worldId,
  );

  if (authorized === null) {
    return respond(
      createErrorResponse({
        code: "authorization_check_failed",
        message: "Could not verify authorization.",
      }),
      502,
    );
  }

  if (!authorized) {
    return respond(
      createErrorResponse({ code: "forbidden", message: "World admin access is required." }),
      403,
    );
  }

  // Fetch all world config data
  const fetchCtx = {
    headers: { apikey: supabaseAnonKey, authorization: authorizationHeader },
    supabaseUrl,
  };

  const exportedAt = new Date().toISOString();
  const fetchResult = await fetchWorldConfigData(fetchCtx, worldId, exportedAt);

  if (!fetchResult.ok) {
    if (fetchResult.reason.startsWith("missing_row:worlds")) {
      return respond(
        createErrorResponse({ code: "world_not_found", message: "World not found." }),
        404,
      );
    }
    return respond(
      createErrorResponse({ code: "fetch_failed", message: "Failed to load world configuration." }),
      502,
    );
  }

  const template = assembleWorldTemplate(fetchResult.data);

  return respond({ ok: true, data: template }, 200);
}

assertEdgeEnvVars([...EDGE_COMMON_ENV_VAR_NAMES, ...EDGE_SERVICE_ROLE_ENV_VAR_NAMES]);

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve((req: Request) => handleExportWorldTemplateRequest(req));
}
