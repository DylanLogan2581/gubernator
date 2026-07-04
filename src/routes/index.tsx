import { createFileRoute } from "@tanstack/react-router";

import { LoadingState } from "@/components/shared/LoadingState";
import {
  redirectAuthenticatedRoute,
  SIGN_IN_DEFAULT_RETURN_PATH,
} from "@/features/auth";
import { HomePage } from "@/features/home";

import type { JSX } from "react";

function HomeRoute(): JSX.Element {
  return <HomePage />;
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
