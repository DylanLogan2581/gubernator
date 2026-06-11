export {
  signInMutationOptions,
  signOutMutationOptions,
  verifyOtpMutationOptions,
  updatePasswordMutationOptions,
} from "./mutations/authMutations";
export { AuthCallbackPage } from "./components/AuthCallbackPage";
export { AuthNavigationControl } from "./components/AuthNavigationControl";
export { SetPasswordPage } from "./components/SetPasswordPage";
export { SignInPage } from "./components/SignInPage";
export { SignOutControl } from "./components/SignOutControl";
export { authQueryKeys } from "./queries/authQueryKeys";
export {
  currentAppUserQueryOptions,
  currentSessionQueryOptions,
} from "./queries/authQueries";
export { availableUsersQueryOptions } from "./queries/usersQueries";
export {
  parseSignInSearch,
  SIGN_IN_DEFAULT_RETURN_PATH,
  signInCredentialsSchema,
  normalizeSignInReturnPath,
} from "./schemas/signInSchemas";
export {
  redirectAuthenticatedRoute,
  requireAuthenticatedRoute,
} from "./utils/protectedRouteGuards";
export { AuthUiError, normalizeSupabaseError } from "./utils/authErrors";

export type {
  AdminPickerUser,
  AppUser,
  AuthErrorDetails,
  SignInWithPasswordInput,
} from "./types/authTypes";
export type {
  SignInCredentials,
  SignInReturnPath,
  SignInSearch,
} from "./schemas/signInSchemas";
