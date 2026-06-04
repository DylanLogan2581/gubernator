import { getRequiredRuntimeEnv } from "./env.ts";
import { createErrorResponse } from "./http.ts";

import type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationAuthorizationResult,
  EndTurnSimulationRequestBody,
} from "./types.ts";

type SupabaseAuthorizationFetchError = {
  readonly safeDeny: boolean;
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

export async function resolveSupabaseEndTurnSimulationAuthorization(
  requestBody: EndTurnSimulationRequestBody,
  authContext: EndTurnSimulationAuthContext,
): Promise<EndTurnSimulationAuthorizationResult> {
  const authorizationHeader = authContext.authorizationHeader;

  if (authorizationHeader === undefined) {
    return createAuthContextUnavailableResult();
  }

  const supabaseUrl = getRequiredRuntimeEnv("SUPABASE_URL");
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

    if (worldExistsResult.value) {
      return { ok: true };
    }

    return createAuthorizationErrorResult();
  }

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
    return createAuthorizationErrorResult();
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
      error: {
        safeDeny: false,
      },
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      error: {
        safeDeny: response.status >= 400 && response.status < 500,
      },
      ok: false,
    };
  }

  const payload: unknown = await response.json();

  if (typeof payload !== "boolean") {
    return {
      error: {
        safeDeny: false,
      },
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
      error: {
        safeDeny: false,
      },
      ok: false,
    };
  }

  if (!response.ok) {
    return {
      error: {
        safeDeny: response.status >= 400 && response.status < 500,
      },
      ok: false,
    };
  }

  const payload: unknown = await response.json();

  if (!Array.isArray(payload)) {
    return {
      error: {
        safeDeny: false,
      },
      ok: false,
    };
  }

  return {
    ok: true,
    value: payload.length > 0,
  };
}

function resultFromSupabaseAuthorizationFetchError(
  error: SupabaseAuthorizationFetchError,
): EndTurnSimulationAuthorizationResult {
  if (error.safeDeny) {
    return createAuthorizationErrorResult();
  }

  return createAuthContextUnavailableResult();
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
