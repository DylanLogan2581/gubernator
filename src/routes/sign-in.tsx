import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

import { SignInPage, parseSignInSearch } from "@/features/auth";

import type { JSX } from "react";

function SignInRoute(): JSX.Element {
  const router = useRouter();
  const { returnTo } = Route.useSearch();
  const handleSignInSuccess = useCallback(() => {
    router.history.push(returnTo);
    return Promise.resolve();
  }, [router, returnTo]);

  return <SignInPage onSignInSuccess={handleSignInSuccess} />;
}

export const Route = createFileRoute("/sign-in")({
  component: SignInRoute,
  validateSearch: parseSignInSearch,
});
