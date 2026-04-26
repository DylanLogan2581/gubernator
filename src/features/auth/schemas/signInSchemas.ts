import { z } from "zod";

export const SIGN_IN_DEFAULT_RETURN_PATH = "/worlds";

export const signInCredentialsSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(256, "Password must be 256 characters or fewer."),
});

const signInSearchSchema = z.object({
  returnTo: z
    .string()
    .optional()
    .transform((value): SignInReturnPath => normalizeSignInReturnPath(value)),
});

export type SignInCredentials = z.infer<typeof signInCredentialsSchema>;
export type SignInReturnPath = "/" | "/worlds";
export type SignInSearch = z.infer<typeof signInSearchSchema>;

export function parseSignInSearch(search: unknown): SignInSearch {
  const result = signInSearchSchema.safeParse(search);

  if (!result.success) {
    return { returnTo: SIGN_IN_DEFAULT_RETURN_PATH };
  }

  return result.data;
}

function normalizeSignInReturnPath(
  value: string | undefined,
): SignInReturnPath {
  switch (value) {
    case "/":
    case "/worlds":
      return value;
    case undefined:
      return SIGN_IN_DEFAULT_RETURN_PATH;
    default:
      return SIGN_IN_DEFAULT_RETURN_PATH;
  }
}
