import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, type JSX } from "react";

import { SIGN_IN_DEFAULT_RETURN_PATH, AuthCallbackPage } from "@/features/auth";

function AuthCallbackRoute(): JSX.Element {
  const router = useRouter();

  const handleSessionVerified = useCallback(async (): Promise<void> => {
    await router.navigate({ to: "/auth/set-password" });
  }, [router]);

  const handleError = useCallback(async (): Promise<void> => {
    await router.navigate({
      to: "/sign-in",
      search: { returnTo: SIGN_IN_DEFAULT_RETURN_PATH },
    });
  }, [router]);

  return (
    <AuthCallbackPage
      onSessionVerified={handleSessionVerified}
      onError={handleError}
    />
  );
}

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackRoute,
});
