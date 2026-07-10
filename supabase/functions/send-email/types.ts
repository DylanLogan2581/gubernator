export type SendEmailErrorCode =
  | "auth_context_unavailable"
  | "invalid_request"
  | "method_not_allowed"
  | "no_recipients"
  | "origin_not_allowed"
  | "rate_limit_exceeded"
  | "recipient_resolution_failed"
  | "send_email_error"
  | "smtp_config_unavailable"
  | "superadmin_required"
  | "too_many_recipients"
  | "unauthenticated";

export type SendEmailKind = "all" | "nation" | "specific" | "test" | "world";

export type SendEmailRequestBody = {
  readonly kind: SendEmailKind;
  readonly subject?: string;
  readonly message?: string;
  readonly userIds?: readonly string[];
  readonly worldId?: string;
  readonly nationId?: string;
  readonly dryRun?: boolean;
};

export type SendEmailSuccessData = {
  readonly recipientCount: number;
  readonly sentCount: number;
  readonly failedCount: number;
  readonly subject: string;
  readonly renderedHtml?: string;
};

export type SendEmailSuccessResponse = {
  readonly data: SendEmailSuccessData;
  readonly ok: true;
};

export type SendEmailErrorResponse = {
  readonly error: {
    readonly code: SendEmailErrorCode;
    readonly message: string;
  };
  readonly ok: false;
};

export type SendEmailResponse = SendEmailErrorResponse | SendEmailSuccessResponse;

export type SendEmailAuthContext = {
  readonly authorizationHeader: string;
  readonly userId: string;
};

export type SendEmailAuthContextResult =
  | {
    readonly context: SendEmailAuthContext;
    readonly ok: true;
  }
  | {
    readonly error: SendEmailErrorResponse;
    readonly ok: false;
    readonly status: number;
  };

export type SendEmailHandlerOptions = {
  readonly allowedOrigins?: readonly string[];
};

export type EmailRecipient = {
  readonly userId: string;
  readonly email: string;
};

export type SendEmailStatusData =
  | {
    readonly configured: true;
    readonly host: string;
    readonly senderName: string;
    readonly adminEmail: string;
  }
  | { readonly configured: false; readonly missing: readonly string[] };

export type SendEmailStatusResponse =
  | SendEmailErrorResponse
  | { readonly data: SendEmailStatusData; readonly ok: true };
