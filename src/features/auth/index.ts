export {
  signInMutationOptions,
  signOutMutationOptions,
} from "./mutations/authMutations";
export { AuthNavigationControl } from "./components/AuthNavigationControl";
export { SignInPage } from "./components/SignInPage";
export { SignOutControl } from "./components/SignOutControl";
export { authQueryKeys } from "./queries/authQueryKeys";
export {
  currentAppUserQueryOptions,
  currentSessionQueryOptions,
} from "./queries/authQueries";
export {
  parseSignInSearch,
  SIGN_IN_DEFAULT_RETURN_PATH,
  signInCredentialsSchema,
  normalizeSignInReturnPath,
} from "./schemas/signInSchemas";
export { requireAuthenticatedRoute } from "./utils/protectedRouteGuards";
export { AuthUiError, normalizeAuthError } from "./utils/authErrors";

export type {
  AppUser,
  AuthErrorDetails,
  SignInWithPasswordInput,
} from "./types/authTypes";
export type {
  SignInCredentials,
  SignInReturnPath,
  SignInSearch,
} from "./schemas/signInSchemas";
