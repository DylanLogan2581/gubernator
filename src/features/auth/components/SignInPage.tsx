import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, LogIn } from "lucide-react";
import {
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { syncAuthStateQueryCache } from "@/lib/authStateQueryCache";

import { signInMutationOptions } from "../mutations/authMutations";
import { authQueryKeys } from "../queries/authQueryKeys";
import { signInCredentialsSchema } from "../schemas/signInSchemas";

import type { SignInCredentials } from "../schemas/signInSchemas";
import type { AuthUiError } from "../utils/authErrors";

type SignInPageProps = {
  readonly onSignInSuccess: () => Promise<void>;
};

type SignInFieldErrors = Partial<Record<keyof SignInCredentials, string>>;

const initialCredentials: SignInCredentials = {
  email: "",
  password: "",
};

export function SignInPage({ onSignInSuccess }: SignInPageProps): JSX.Element {
  const formDescriptionId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const formErrorId = useId();
  const queryClient = useQueryClient();
  const signInMutation = useMutation(signInMutationOptions());
  const [credentials, setCredentials] =
    useState<SignInCredentials>(initialCredentials);
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const isSubmitting = signInMutation.isPending;

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>): void {
    setCredentials((currentCredentials) => ({
      ...currentCredentials,
      email: event.target.value,
    }));
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>): void {
    setCredentials((currentCredentials) => ({
      ...currentCredentials,
      password: event.target.value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitSignIn();
  }

  async function submitSignIn(): Promise<void> {
    const result = signInCredentialsSchema.safeParse(credentials);

    if (!result.success) {
      setFieldErrors({
        email: result.error.flatten().fieldErrors.email?.[0],
        password: result.error.flatten().fieldErrors.password?.[0],
      });
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    try {
      const signInResult = await signInMutation.mutateAsync(result.data);
      syncAuthStateQueryCache(queryClient, signInResult.session);
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
      await onSignInSuccess();
    } catch (error) {
      setFormError(getSafeSignInErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 py-6">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p
            id={formDescriptionId}
            className="mt-2 text-sm text-muted-foreground"
          >
            Use your Gubernator account to continue to your worlds.
          </p>
        </div>

        <form
          noValidate
          aria-describedby={formDescriptionId}
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          {formError !== null ? (
            <p
              id={formErrorId}
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sign-in-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="sign-in-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={credentials.email}
              aria-describedby={
                fieldErrors.email === undefined ? undefined : emailErrorId
              }
              aria-invalid={fieldErrors.email === undefined ? undefined : true}
              disabled={isSubmitting}
              onChange={handleEmailChange}
            />
            {fieldErrors.email === undefined ? null : (
              <p id={emailErrorId} className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sign-in-password" className="text-sm font-medium">
              Password
            </label>
            <Input
              id="sign-in-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={credentials.password}
              aria-describedby={
                fieldErrors.password === undefined ? undefined : passwordErrorId
              }
              aria-invalid={
                fieldErrors.password === undefined ? undefined : true
              }
              disabled={isSubmitting}
              onChange={handlePasswordChange}
            />
            {fieldErrors.password === undefined ? null : (
              <p id={passwordErrorId} className="text-sm text-destructive">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <LogIn aria-hidden="true" />
            )}
            Sign in
          </Button>
        </form>
      </section>
    </div>
  );
}

function getSafeSignInErrorMessage(error: unknown): string {
  const authError = error as Partial<AuthUiError>;

  if (authError.code === "supabase_configuration_missing") {
    return "Sign-in is unavailable because authentication is not configured.";
  }

  return "Email or password is incorrect.";
}
