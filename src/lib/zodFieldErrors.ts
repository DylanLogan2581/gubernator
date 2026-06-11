import { useState, type SetStateAction } from "react";

import type { ZodError } from "zod";

/**
 * Extracts the first validation error message per field from a Zod error.
 * Returns a Record mapping field names (from issue.path[0]) to their first error message.
 */
export function firstIssuePerField(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0]);
    if (!(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

/**
 * Hook for managing form field errors from Zod validation results.
 * Provides state management and helper methods for setting/clearing errors.
 *
 * @template TKeys - Union type of valid field keys (ensures type-safe error setting)
 * @returns Object with fieldErrors state, setFromZod method, and clear method
 *
 * @example
 * type MyFieldErrors = {
 *   readonly name?: string;
 *   readonly email?: string;
 * };
 *
 * const { fieldErrors, setFromZod, clear } = useFieldErrors<keyof MyFieldErrors>();
 *
 * const result = mySchema.safeParse(input);
 * if (!result.success) {
 *   setFromZod(result.error);
 *   return;
 * }
 */
export function useFieldErrors<TKeys extends PropertyKey = string>(): {
  readonly fieldErrors: Record<TKeys, string | undefined>;
  readonly setFromZod: (error: ZodError) => void;
  readonly clear: () => void;
} {
  const [fieldErrors, setFieldErrors] = useState<
    Record<TKeys, string | undefined>
  >({} as Record<TKeys, string | undefined>);

  const setFromZod = (error: ZodError): void => {
    const extracted = firstIssuePerField(error);
    setFieldErrors(
      extracted as SetStateAction<Record<TKeys, string | undefined>>,
    );
  };

  const clear = (): void => {
    setFieldErrors({} as Record<TKeys, string | undefined>);
  };

  return {
    fieldErrors,
    /**
     * Extract and set field errors from a Zod validation error.
     */
    setFromZod,
    /**
     * Clear all field errors.
     */
    clear,
  };
}
