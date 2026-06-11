export type AdminCreateUserErrorCode =
  | "auth_admin_error"
  | "auth_context_unavailable"
  | "email_conflict"
  | "invalid_request"
  | "method_not_allowed"
  | "origin_not_allowed"
  | "superadmin_required"
  | "unauthenticated";

export type AdminCreateUserRequestBody = {
  readonly email: string;
  readonly sendMagicLink?: boolean;
  readonly username: string;
  readonly password?: string;
};

export type AdminCreateUserSuccessData = {
  readonly email: string;
  readonly userId: string;
  readonly username: string;
};

export type AdminCreateUserSuccessResponse = {
  readonly data: AdminCreateUserSuccessData;
  readonly ok: true;
};

export type AdminCreateUserErrorResponse = {
  readonly error: {
    readonly code: AdminCreateUserErrorCode;
    readonly message: string;
  };
  readonly ok: false;
};

export type AdminCreateUserResponse =
  | AdminCreateUserErrorResponse
  | AdminCreateUserSuccessResponse;

export type AdminCreateUserAuthContext = {
  readonly authorizationHeader: string;
  readonly userId: string;
};

export type AdminCreateUserAuthContextResult =
  | {
    readonly context: AdminCreateUserAuthContext;
    readonly ok: true;
  }
  | {
    readonly error: AdminCreateUserErrorResponse;
    readonly ok: false;
    readonly status: number;
  };

export type AdminCreateUserHandlerOptions = {
  readonly allowedOrigins?: readonly string[];
};
