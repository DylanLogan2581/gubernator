import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { LoadingState } from "@/components/shared/LoadingState";
import {
  SignInPage,
  parseSignInSearch,
  redirectAuthenticatedRoute,
} from "@/features/auth";

import type { JSX } from "react";

function SignInRoute(): JSX.Element {
  const router = useRouter();
  const { returnTo } = Route.useSearch();
  const handleSignInSuccess = useCallback(async () => {
    await router.navigate({ href: returnTo });
  }, [router, returnTo]);

  return <SignInPage onSignInSuccess={handleSignInSuccess} />;
}

export const Route = createFileRoute("/sign-in")({
  beforeLoad: ({ context, search }) =>
    redirectAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: search.returnTo,
    }),
  component: SignInRoute,
  pendingComponent: SignInPendingRoute,
  validateSearch: parseSignInSearch,
});

function SignInPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
