/**
 * Structured request/error logging for privileged edge functions.
 * Emits JSON logs to console for persistence in Deno and Node/Vitest runtimes.
 * Provides request tracing with generated request IDs and error detail preservation.
 */

export type EdgeRequestLogEntry = {
  readonly timestamp: string;
  readonly event: string;
  readonly requestId: string;
  readonly actorId?: string;
  readonly worldId?: string;
  [key: string]: string | number | boolean | undefined;
};

/**
 * Generate a unique request ID for tracing.
 */
export function generateRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

/**
 * Log the start of a privileged request with context.
 * @param requestId - Unique request identifier
 * @param actorId - The actor (user ID) initiating the request
 * @param worldId - The world ID being acted upon (optional)
 * @param operation - The operation being performed (e.g., "start_turn_transition")
 */
export function logRequestEntry(
  requestId: string,
  actorId: string,
  operation: string,
  worldId?: string,
): void {
  const entry: EdgeRequestLogEntry = {
    actorId,
    event: "request_entry",
    operation,
    requestId,
    timestamp: new Date().toISOString(),
    worldId,
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}

/**
 * Log a caught error with preserved RPC details.
 * @param requestId - The request ID for tracing
 * @param errorCode - The error code (e.g., RPC code from Supabase)
 * @param errorMessage - The error message
 * @param errorHint - The error hint (optional, from RPC or other context)
 */
export function logCaughtError(
  requestId: string,
  errorCode: string,
  errorMessage: string,
  errorHint?: string,
): void {
  const entry: EdgeRequestLogEntry = {
    errorCode,
    errorHint,
    errorMessage,
    event: "error_caught",
    requestId,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}

/**
 * Log a successful request outcome.
 * @param requestId - The request ID for tracing
 * @param summary - A summary of the successful operation
 */
export function logRequestSuccess(requestId: string, summary: string): void {
  const entry: EdgeRequestLogEntry = {
    event: "request_success",
    requestId,
    summary,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}

/**
 * Log a request failure with error details.
 * @param requestId - The request ID for tracing
 * @param errorCode - The error code to be returned to the client
 * @param reason - The internal reason for failure
 */
export function logRequestFailure(
  requestId: string,
  errorCode: string,
  reason: string,
): void {
  const entry: EdgeRequestLogEntry = {
    errorCode,
    event: "request_failure",
    reason,
    requestId,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}

/**
 * Log a response parsing error with context.
 * @param requestId - The request ID for tracing
 * @param responseStatus - HTTP status code of the response
 * @param parseError - The parse error message
 */
export function logResponseParseError(
  requestId: string,
  responseStatus: number,
  parseError: string,
): void {
  const entry: EdgeRequestLogEntry = {
    event: "response_parse_error",
    parseError,
    requestId,
    responseStatus,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}
