export function getAuthorizationHeader(request: Request): string | null {
  const authorizationHeader = request.headers.get("authorization");

  if (authorizationHeader === null) {
    return null;
  }

  const trimmedHeader = authorizationHeader.trim();

  if (!trimmedHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const bearerToken = trimmedHeader.slice("bearer ".length).trim();

  if (bearerToken.length === 0) {
    return null;
  }

  return `Bearer ${bearerToken}`;
}

export function validateAuthUserPayload(
  value: unknown,
): value is { readonly id: string } {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return typeof obj.id === "string" && (obj.id).length > 0;
}

export async function resolveAuthContext<
  TAuthContext,
  TErrorResponse = unknown,
>(
  request: Request,
  options: {
    readonly fetchFn: (url: string, opts: RequestInit) => Promise<Response>;
    readonly supabaseUrl: string;
    readonly supabaseAnonKey: string;
    readonly onAuthError: () => {
      readonly ok: false;
      readonly error: TErrorResponse;
      readonly status: number;
    };
    readonly onSuccess: (context: TAuthContext) => {
      readonly ok: true;
      readonly context: TAuthContext;
    };
  },
): Promise<
  | {
      readonly ok: false;
      readonly error: TErrorResponse;
      readonly status: number;
    }
  | { readonly ok: true; readonly context: TAuthContext }
> {
  const authHeader = getAuthorizationHeader(request);

  if (authHeader === null) {
    return options.onAuthError();
  }

  let userPayload: unknown;

  try {
    const response = await options.fetchFn(
      `${options.supabaseUrl}/auth/v1/user`,
      {
        headers: {
          authorization: authHeader,
          apikey: options.supabaseAnonKey,
        },
      },
    );

    if (!response.ok) {
      return options.onAuthError();
    }

    userPayload = await response.json();
  } catch {
    return options.onAuthError();
  }

  if (!validateAuthUserPayload(userPayload)) {
    return options.onAuthError();
  }

  const context: TAuthContext = {
    userId: userPayload.id,
  } as TAuthContext;

  return options.onSuccess(context);
}
