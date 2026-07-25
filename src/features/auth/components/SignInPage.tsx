import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, LogIn, TriangleAlert } from "lucide-react";
import {
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
  type JSX,
} from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const queryClient = useQueryClient();
  const signInMutation = useMutation(signInMutationOptions());
  const [credentials, setCredentials] =
    useState<SignInCredentials>(initialCredentials);
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({});
  const [signInErrorMessage, setSignInErrorMessage] = useState<string | null>(
    null,
  );
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
      return;
    }

    setFieldErrors({});
    setSignInErrorMessage(null);

    try {
      const signInResult = await signInMutation.mutateAsync(result.data);
      syncAuthStateQueryCache(queryClient, signInResult.session);
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
      await onSignInSuccess();
    } catch (error) {
      setSignInErrorMessage(getSafeSignInErrorMessage(error));
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <section
          aria-hidden="true"
          className="hidden flex-col justify-center gap-6 rounded-xl bg-gradient-to-br from-primary/15 via-card to-card p-10 ring-1 ring-foreground/10 lg:flex"
        >
          <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 p-4">
            <img src="/logo.png" alt="" className="size-full object-contain" />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Gubernator
            </h2>
            <p className="max-w-sm text-muted-foreground text-balance">
              A turn-based world simulation game: found nations, grow
              settlements, and steer generations of citizens through the outcome
              of every turn.
            </p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center lg:items-start lg:text-left">
            <div className="flex items-center gap-2 lg:hidden">
              <img src="/logo.png" alt="" className="size-6" />
              <span className="font-semibold">Gubernator</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
              <p
                id={formDescriptionId}
                className="mt-2 text-sm text-muted-foreground"
              >
                Use your Gubernator account to continue to your worlds.
              </p>
            </div>
          </div>

          <form
            noValidate
            aria-describedby={formDescriptionId}
            className="flex flex-col gap-4"
            onSubmit={handleSubmit}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sign-in-email">Email</Label>
              <Input
                id="sign-in-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                aria-required="true"
                value={credentials.email}
                aria-describedby={
                  fieldErrors.email === undefined ? undefined : emailErrorId
                }
                aria-invalid={
                  fieldErrors.email === undefined ? undefined : true
                }
                disabled={isSubmitting}
                onChange={handleEmailChange}
              />
              <div className="min-h-5">
                {fieldErrors.email === undefined ? null : (
                  <p id={emailErrorId} className="text-sm text-destructive">
                    {fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sign-in-password">Password</Label>
              <Input
                id="sign-in-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-required="true"
                value={credentials.password}
                aria-describedby={
                  fieldErrors.password === undefined
                    ? undefined
                    : passwordErrorId
                }
                aria-invalid={
                  fieldErrors.password === undefined ? undefined : true
                }
                disabled={isSubmitting}
                onChange={handlePasswordChange}
              />
              <div className="min-h-5">
                {fieldErrors.password === undefined ? null : (
                  <p id={passwordErrorId} className="text-sm text-destructive">
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </div>

            <div className="min-h-[2.375rem]">
              {signInErrorMessage === null ? null : (
                <Alert variant="destructive">
                  <TriangleAlert aria-hidden="true" />
                  <AlertDescription>{signInErrorMessage}</AlertDescription>
                </Alert>
              )}
            </div>

            <Button
              type="submit"
              className="mt-1 w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <LogIn aria-hidden="true" />
              )}
              Sign in
            </Button>
            <p aria-live="polite" className="sr-only">
              {isSubmitting ? "Signing in…" : ""}
            </p>
          </form>
        </section>
      </div>
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
