export type AdminCreateUserErrorCode =
  | "auth_context_unavailable"
  | "create_user_failed"
  | "invalid_request"
  | "method_not_allowed"
  | "unauthenticated"
  | "unauthorized"
  | "user_already_exists";

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
