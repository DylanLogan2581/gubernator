import type { MutationIssue } from "./mutationError";
import type { z } from "zod";

export function parseMutationInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  toError: (issues: readonly MutationIssue[]) => Error,
): z.output<TSchema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw toError(
      result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
    );
  }

  return result.data;
}
