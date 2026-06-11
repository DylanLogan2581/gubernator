/**
 * Structured audit logging for privileged operations.
 * Emits JSON logs to console for persistence in Deno and Node/Vitest runtimes.
 * Never logs bearer tokens or service-role keys.
 */

export type AuditLogEntry = {
  readonly timestamp: string;
  readonly event: string;
  [key: string]: string | number | boolean | undefined;
};

/**
 * Log an authorization denial with structured data.
 * @param userId - The verified caller's user ID
 * @param target - The target resource (worldId or email)
 * @param reason - The denial reason (e.g., "superadmin_required", "world_admin_required")
 */
export function logAuthorizationDenial(
  userId: string,
  target: string,
  reason: string,
): void {
  const entry: AuditLogEntry = {
    event: "authorization_denied",
    reason,
    target,
    timestamp: new Date().toISOString(),
    userId,
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}

/**
 * Log a successful end-turn operation.
 * @param userId - The verified caller's user ID
 * @param worldId - The world ID being advanced
 * @param fromTurn - The turn number before transition
 * @param toTurn - The turn number after transition
 * @param transitionId - The unique transition identifier
 */
export function logEndTurnSuccess(
  userId: string,
  worldId: string,
  fromTurn: number,
  toTurn: number,
  transitionId: string,
): void {
  const entry: AuditLogEntry = {
    event: "end_turn_success",
    fromTurn,
    timestamp: new Date().toISOString(),
    toTurn,
    transitionId,
    userId,
    worldId,
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}

/**
 * Log a successful admin user creation.
 * @param actingUserId - The super-admin user ID performing the creation
 * @param newUserId - The newly created user's ID
 * @param email - The new user's email
 */
export function logAdminCreateUserSuccess(
  actingUserId: string,
  newUserId: string,
  email: string,
): void {
  const entry: AuditLogEntry = {
    actingUserId,
    email,
    event: "admin_create_user_success",
    newUserId,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}

/**
 * Log an authentication failure.
 * @param reason - The failure reason (e.g., "session_expired", "auth_context_unavailable")
 */
export function logAuthenticationFailure(reason: string): void {
  const entry: AuditLogEntry = {
    event: "authentication_failed",
    reason,
    timestamp: new Date().toISOString(),
  };
  // eslint-disable-next-line no-restricted-syntax
  console.log(JSON.stringify(entry));
}
