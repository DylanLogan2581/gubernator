import { logAuthorizationDenial } from "../_shared/auditLog.ts";

import { getRequiredRuntimeEnv, getRequiredRuntimeUrl } from "./env.ts";
import { createErrorResponse } from "./http.ts";

import type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationAuthorizationResult,
  EndTurnSimulationRequestBody,
} from "./types.ts";

type SupabaseAuthorizationFetchError = {
  readonly status: number;
};

type SupabaseBooleanFetchResult =
  | {
      readonly ok: true;
      readonly value: boolean;
    }
  | {
      readonly error: SupabaseAuthorizationFetchError;
      readonly ok: false;
    };

type SupabaseWorldStatusResult =
  | {
      readonly ok: true;
      readonly status: string;
      readonly currentTurnNumber: number;
    }
  | {
      readonly error: SupabaseAuthorizationFetchError;
      readonly ok: false;
    };

export async function resolveSupabaseEndTurnSimulationAuthorization(
  requestBody: EndTurnSimulationRequestBody,
  authContext: EndTurnSimulationAuthContext,
): Promise<EndTurnSimulationAuthorizationResult> {
  const authorizationHeader = authContext.authorizationHeader;

  if (authorizationHeader === undefined) {
    return createAuthContextUnavailableResult();
  }

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return createAuthContextUnavailableResult();
  }

  const superAdminResult = await fetchSupabaseRpcBoolean({
    authorizationHeader,
    body: {},
    functionName: "is_super_admin",
    supabaseAnonKey,
    supabaseUrl,
  });

  if (!superAdminResult.ok) {
    return resultFromSupabaseAuthorizationFetchError(superAdminResult.error);
  }

  if (superAdminResult.value) {
    // Super admins can see all worlds via their RLS policy, so the user JWT
    // works here without service-role escalation.
    // If ES256 JWT verification fails locally (Docker + newer Supabase Auth),
    // set IS_LOCAL_DEV=true and handle the workaround in a dev-only path —
    // never bypass auth in the production code path.
    const worldExistsResult = await fetchSupabaseWorldExists({
      authorizationHeader,
      supabaseAnonKey,
      supabaseUrl,
      worldId: requestBody.worldId,
    });

    if (!worldExistsResult.ok) {
      return resultFromSupabaseAuthorizationFetchError(worldExistsResult.error);
    }

    if (!worldExistsResult.value) {
      logAuthorizationDenial(
        authContext.userId,
        requestBody.worldId,
        "world_not_found",
      );
      return createAuthorizationErrorResult();
    }
  } else {
    // Non-super-admin path: check world admin authority
    const worldAdminResult = await fetchSupabaseRpcBoolean({
      authorizationHeader,
      body: {
        p_world_id: requestBody.worldId,
      },
      functionName: "is_world_admin",
      supabaseAnonKey,
      supabaseUrl,
    });

    if (!worldAdminResult.ok) {
      return resultFromSupabaseAuthorizationFetchError(worldAdminResult.error);
    }

    if (!worldAdminResult.value) {
      logAuthorizationDenial(
        authContext.userId,
        requestBody.worldId,
        "world_admin_required",
      );
      return createAuthorizationErrorResult();
    }
  }

  // Gate on world status and expectedTurnNumber before state load (all paths)
  const worldStatusResult = await fetchSupabaseWorldStatusAndTurn({
    authorizationHeader,
    supabaseAnonKey,
    supabaseUrl,
    worldId: requestBody.worldId,
  });

  if (!worldStatusResult.ok) {
    return resultFromSupabaseAuthorizationFetchError(worldStatusResult.error);
  }

  if (worldStatusResult.status === "archived") {
    return {
      error: createErrorResponse({
        code: "end_turn_world_archived",
        message: "World is archived and cannot be advanced.",
      }),
      ok: false,
      status: 409,
    };
  }

  if (worldStatusResult.currentTurnNumber !== requestBody.expectedTurnNumber) {
    return {
      error: createErrorResponse({
        code: "end_turn_stale_expected_turn",
        message: "Expected current turn no longer matches the world state.",
      }),
      ok: false,
      status: 409,
    };
  }

  return { ok: true };
}

async function fetchSupabaseRpcBoolean({
  authorizationHeader,
  body,
  functionName,
  supabaseAnonKey,
  supabaseUrl,
}: {
  readonly authorizationHeader: string;
  readonly body: Record<string, unknown>;
  readonly functionName: string;
  readonly supabaseAnonKey: string;
  readonly supabaseUrl: string;
}): Promise<SupabaseBooleanFetchResult> {
  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
      body: JSON.stringify(body),
      headers: {
        apikey: supabaseAnonKey,
        authorization: authorizationHeader,
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return {
      error: { status: 0 },
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      error: { status: response.status },
      ok: false,
    };
  }

  const payload: unknown = await response.json();

  if (typeof payload !== "boolean") {
    return {
      error: { status: 0 },
      ok: false,
    };
  }

  return {
    ok: true,
    value: payload,
  };
}

async function fetchSupabaseWorldExists({
  authorizationHeader,
  supabaseAnonKey,
  supabaseUrl,
  worldId,
}: {
  readonly authorizationHeader: string;
  readonly supabaseAnonKey: string;
  readonly supabaseUrl: string;
  readonly worldId: string;
}): Promise<SupabaseBooleanFetchResult> {
  const searchParameters = new URLSearchParams({
    id: `eq.${worldId}`,
    limit: "1",
    select: "id",
  });
  let response: Response;

  try {
    response = await fetch(
      `${supabaseUrl}/rest/v1/worlds?${searchParameters}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          authorization: authorizationHeader,
        },
        method: "GET",
      },
    );
  } catch {
    return {
      error: { status: 0 },
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      error: { status: response.status },
      ok: false,
    };
  }

  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    return {
      error: { status: 0 },
      ok: false,
    };
  }

  return {
    ok: true,
    value: payload.length > 0,
  };
}

async function fetchSupabaseWorldStatusAndTurn({
  authorizationHeader,
  supabaseAnonKey,
  supabaseUrl,
  worldId,
}: {
  readonly authorizationHeader: string;
  readonly supabaseAnonKey: string;
  readonly supabaseUrl: string;
  readonly worldId: string;
}): Promise<SupabaseWorldStatusResult> {
  const searchParameters = new URLSearchParams({
    id: `eq.${worldId}`,
    limit: "1",
    select: "status,current_turn_number",
  });
  let response: Response;

  try {
    response = await fetch(
      `${supabaseUrl}/rest/v1/worlds?${searchParameters}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          authorization: authorizationHeader,
        },
        method: "GET",
      },
    );
  } catch {
    return {
      error: { status: 0 },
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      error: { status: response.status },
      ok: false,
    };
  }

  const payload: unknown = await response.json();

  if (
    !Array.isArray(payload) ||
    payload.length === 0 ||
    typeof payload[0] !== "object" ||
    payload[0] === null
  ) {
    return {
      error: { status: 0 },
      ok: false,
    };
  }

  const row = payload[0] as Record<string, unknown>;

  if (
    typeof row.status !== "string" ||
    typeof row.current_turn_number !== "number"
  ) {
    return {
      error: { status: 0 },
      ok: false,
    };
  }

  return {
    ok: true,
    status: row.status,
    currentTurnNumber: row.current_turn_number,
  };
}

function resultFromSupabaseAuthorizationFetchError(
  error: SupabaseAuthorizationFetchError,
): EndTurnSimulationAuthorizationResult {
  if (error.status === 401) {
    return createSessionExpiredResult();
  }

  if (error.status >= 400 && error.status < 500) {
    return createAuthorizationErrorResult();
  }

  return createAuthContextUnavailableResult();
}

function createSessionExpiredResult(): EndTurnSimulationAuthorizationResult {
  return {
    error: createErrorResponse({
      code: "session_expired",
      message: "Please sign in again.",
    }),
    ok: false,
    status: 401,
  };
}

function createAuthorizationErrorResult(): EndTurnSimulationAuthorizationResult {
  return {
    error: createErrorResponse({
      code: "unauthorized",
      message: "End turn is unavailable for this world.",
    }),
    ok: false,
    status: 403,
  };
}

function createAuthContextUnavailableResult(): EndTurnSimulationAuthorizationResult {
  return {
    error: createErrorResponse({
      code: "auth_context_unavailable",
      message: "Supabase auth configuration is unavailable.",
    }),
    ok: false,
    status: 500,
  };
}
