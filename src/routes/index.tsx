import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import {
  SignInPage,
  SIGN_IN_DEFAULT_RETURN_PATH,
  redirectAuthenticatedRoute,
} from "@/features/auth";

import type { JSX } from "react";

function HomeRoute(): JSX.Element {
  const router = useRouter();
  const handleSignInSuccess = useCallback(async () => {
    await router.navigate({ href: SIGN_IN_DEFAULT_RETURN_PATH });
  }, [router]);

  return <SignInPage onSignInSuccess={handleSignInSuccess} />;
}

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) =>
    redirectAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: SIGN_IN_DEFAULT_RETURN_PATH,
    }),
  component: HomeRoute,
  pendingComponent: HomePendingRoute,
});

function HomePendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
