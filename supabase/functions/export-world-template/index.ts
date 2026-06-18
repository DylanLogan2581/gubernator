import { buildCorsHeaders, parseAllowedOrigins } from "../_shared/http/cors.ts";
import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "../_shared/http/env.ts";
import { createErrorResponse, createJsonResponse } from "../_shared/http/response.ts";
import { getAuthorizationHeader } from "../_shared/http/session.ts";
import { supabaseFetch } from "../_shared/supabaseFetch.ts";

import { assembleWorldTemplate } from "./assemble.ts";
import { fetchWorldConfigData } from "./query.ts";

// Deno runtime declaration (provided by Supabase Edge Runtime)
declare const Deno: { serve: (handler: (req: Request) => Promise<Response>) => void };

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleExportWorldTemplateRequest(
  request: Request,
  options: { readonly allowedOrigins?: readonly string[] } = {},
): Promise<Response> {
  const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
  const origin = request.headers.get("origin");
  const allowedOrigin = origin !== null && allowedOrigins.includes(origin) ? origin : null;

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

  // Parse body
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return respond(
      createErrorResponse({ code: "invalid_request", message: "Request body must be JSON." }),
      400,
    );
  }

  if (
    parsedBody === null ||
    typeof parsedBody !== "object" ||
    !("worldId" in parsedBody) ||
    typeof (parsedBody as Record<string, unknown>).worldId !== "string" ||
    !UUID_REGEX.test((parsedBody as Record<string, unknown>).worldId as string)
  ) {
    return respond(
      createErrorResponse({ code: "invalid_request", message: "worldId must be a UUID." }),
      400,
    );
  }

  const worldId = (parsedBody as Record<string, unknown>).worldId as string;

  // Auth: extract JWT
  const authorizationHeader = getAuthorizationHeader(request);
  if (authorizationHeader === null) {
    return respond(
      createErrorResponse({ code: "unauthenticated", message: "Authentication required." }),
      401,
    );
  }

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return respond(
      createErrorResponse({ code: "configuration_error", message: "Supabase configuration unavailable." }),
      500,
    );
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
      createErrorResponse({ code: "authorization_check_failed", message: "Could not verify authorization." }),
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

Deno.serve((req: Request) => handleExportWorldTemplateRequest(req));
