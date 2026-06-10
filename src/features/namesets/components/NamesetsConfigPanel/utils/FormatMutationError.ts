import { isNamesetMutationError } from "../../../mutations/namesetsMutations";

export function formatMutationError(error: unknown): string {
  if (isNamesetMutationError(error)) {
    if (error.issues.length > 0) {
      const issue = error.issues[0];
      const fieldPath =
        issue.path.length > 0 ? `${String(issue.path[0])}: ` : "";
      // Special handling for UUID validation errors
      if (issue.message.includes("uuid")) {
        return "World ID is invalid. Please reload the page.";
      }
      return `${fieldPath}${issue.message}`;
    }
  }
  return error instanceof Error ? error.message : "Failed to save nameset.";
}
