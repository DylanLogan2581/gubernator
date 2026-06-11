import { toast } from "sonner";

/**
 * Standard error handler for CRUD mutation callbacks.
 * Extracts error message or uses fallback.
 *
 * Usage: onError: (error) => handleCrudError(error, "Failed to delete item.")
 */
export function handleCrudError(error: unknown, fallbackMessage: string): void {
  const message = error instanceof Error ? error.message : fallbackMessage;
  toast.error(message);
}
