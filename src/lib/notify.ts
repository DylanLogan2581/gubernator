import { toast, Toaster } from "sonner";

import { getErrorDescription } from "./errorUtils";

// Re-export the Toaster host component so the root layout can render toasts
// without importing sonner directly (see the no-restricted-imports gate).
export { Toaster };

// Postgres hint raised by the database guard that rejects gameplay writes while
// a world turn transition is running. Duplicated here rather than imported from
// the turns feature: src/lib must not depend on a feature module.
const WORLD_TURN_IN_PROGRESS_HINT = "world_turn_in_progress";

const WORLD_TURN_IN_PROGRESS_MESSAGE =
  "The turn is advancing — your change was not saved.";

export type NotifyMutationOptions = {
  readonly description?: string;
};

export function notifyMutationSuccess(
  message: string,
  options?: NotifyMutationOptions,
): void {
  toast.success(message, options);
}

export function notifyMutationError(error: unknown, fallback?: string): void {
  toast.error(resolveMutationErrorMessage(error, fallback));
}

/**
 * Show an error toast for a caller-supplied message (and optional description)
 * that is not derived from a thrown mutation error. Use notifyMutationError
 * whenever the message should be unwrapped from an error/issues object.
 */
export function notifyError(
  message: string,
  options?: NotifyMutationOptions,
): void {
  toast.error(message, options);
}

export function resolveMutationErrorMessage(
  error: unknown,
  fallback?: string,
): string {
  if (hasWorldTurnInProgressHint(error)) {
    return WORLD_TURN_IN_PROGRESS_MESSAGE;
  }
  // Unwrap validation issues from typed errors like {issues: [{message: string}]}
  if (error !== null && typeof error === "object" && "issues" in error) {
    const errorWithIssues = error as Record<string, unknown>;
    const issues = errorWithIssues.issues;
    if (Array.isArray(issues) && issues.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const firstIssue = issues[0];
      if (
        firstIssue !== null &&
        typeof firstIssue === "object" &&
        "message" in firstIssue
      ) {
        const msgFromIssue = (firstIssue as Record<string, unknown>).message;
        if (typeof msgFromIssue === "string") {
          return msgFromIssue;
        }
      }
    }
  }
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  if (fallback !== undefined && fallback !== "") {
    return fallback;
  }
  return getErrorDescription(error);
}

function hasWorldTurnInProgressHint(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "hint" in error &&
    (error as { hint?: unknown }).hint === WORLD_TURN_IN_PROGRESS_HINT
  );
}
