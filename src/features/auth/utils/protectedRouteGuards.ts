import { redirect } from "@tanstack/react-router";

import { currentSessionQueryOptions } from "../queries/authQueries";
import { normalizeSignInReturnPath } from "../schemas/signInSchemas";

import type { QueryClient } from "@tanstack/react-query";

type RequireAuthenticatedRouteOptions = {
  readonly queryClient: QueryClient;
  readonly returnTo: string;
};

export async function requireAuthenticatedRoute({
  queryClient,
  returnTo,
}: RequireAuthenticatedRouteOptions): Promise<ReturnType<
  typeof redirect
> | void> {
  const session = await queryClient.ensureQueryData(
    currentSessionQueryOptions(),
  );

  if (session === null) {
    return redirect({
      search: { returnTo: normalizeSignInReturnPath(returnTo) },
      to: "/sign-in",
    });
  }
}
