import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import { SignInPage, parseSignInSearch } from "@/features/auth";

import type { JSX } from "react";

function SignInRoute(): JSX.Element {
  const navigate = Route.useNavigate();
  const { returnTo } = Route.useSearch();
  const handleSignInSuccess = useCallback(
    () => navigate({ to: returnTo }),
    [navigate, returnTo],
  );

  return <SignInPage onSignInSuccess={handleSignInSuccess} />;
}

export const Route = createFileRoute("/sign-in")({
  component: SignInRoute,
  validateSearch: parseSignInSearch,
});
