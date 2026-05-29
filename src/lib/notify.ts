import { toast } from "sonner";

import { getErrorDescription } from "./errorUtils";

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

export function resolveMutationErrorMessage(
  error: unknown,
  fallback?: string,
): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  if (fallback !== undefined && fallback !== "") {
    return fallback;
  }
  return getErrorDescription(error);
}
