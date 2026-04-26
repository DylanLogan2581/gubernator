export {
  signInMutationOptions,
  signOutMutationOptions,
} from "./mutations/authMutations";
export { authQueryKeys } from "./queries/authQueryKeys";
export {
  currentAppUserQueryOptions,
  currentSessionQueryOptions,
} from "./queries/authQueries";
export { AuthUiError, normalizeAuthError } from "./utils/authErrors";

export type {
  AppUser,
  AuthErrorDetails,
  SignInWithPasswordInput,
} from "./types/authTypes";
