import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, type JSX } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import {
  SIGN_IN_DEFAULT_RETURN_PATH,
  currentSessionQueryOptions,
} from "@/features/auth";

function AuthCallbackRoute(): JSX.Element {
  const router = useRouter();

  // Verify that the magic link callback set the session
  const {
    data: session,
    isLoading,
    error,
  } = useQuery(currentSessionQueryOptions());

  const handleReturnToSignIn = useCallback((): void => {
    void router.navigate({
      to: "/sign-in",
      search: { returnTo: SIGN_IN_DEFAULT_RETURN_PATH },
    });
  }, [router]);

  // Navigate to set-password once session is verified
  useQuery({
    enabled: session !== null && session !== undefined,
    queryFn: async () => {
      await router.navigate({ to: "/auth/set-password" });
      return null;
    },
    queryKey: ["auth", "callback", "navigate", router],
  });

  if (isLoading) {
    return <LoadingState label="Completing sign up…" />;
  }

  if (error !== null || session === null) {
    const message =
      error instanceof Error
        ? error.message
        : "Authentication failed. Please try the magic link again.";

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-destructive mb-2">
            Authentication Error
          </h1>
          <p className="text-sm text-muted-foreground mb-4">{message}</p>
          <button
            onClick={handleReturnToSignIn}
            className="text-sm text-primary hover:underline"
            type="button"
          >
            Return to sign in
          </button>
        </div>
      </div>
    );
  }

  return <LoadingState label="Completing sign up…" />;
}

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackRoute,
});
