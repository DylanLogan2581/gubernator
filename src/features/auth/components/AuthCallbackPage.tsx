import { useQuery } from "@tanstack/react-query";
import { type JSX } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { currentSessionQueryOptions } from "@/features/auth";

type AuthCallbackPageProps = {
  readonly onSessionVerified: () => Promise<void>;
  readonly onError: () => Promise<void>;
};

export function AuthCallbackPage({
  onSessionVerified,
  onError,
}: AuthCallbackPageProps): JSX.Element {
  const {
    data: session,
    isLoading,
    error,
  } = useQuery(currentSessionQueryOptions());

  // Navigate to set-password once session is verified
  useQuery({
    enabled: session !== null && session !== undefined,
    queryFn: async () => {
      await onSessionVerified();
      return null;
    },
    queryKey: ["auth", "callback", "navigate", onSessionVerified],
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
          <Button
            onClick={() => void onError()}
            variant="link"
            className="text-sm"
          >
            Return to sign in
          </Button>
        </div>
      </div>
    );
  }

  return <LoadingState label="Completing sign up…" />;
}
