import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { requireAuthenticatedRoute } from "@/features/auth";
import { currentAccessContextQueryOptions } from "@/features/permissions";

import type { JSX } from "react";

function SuperadminRoute(): JSX.Element {
  return <Outlet />;
}

export const Route = createFileRoute("/superadmin")({
  beforeLoad: async ({ context, location }) => {
    const authRedirect = await requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    });

    if (authRedirect !== undefined) {
      return authRedirect;
    }

    const accessContext = await context.queryClient.ensureQueryData(
      currentAccessContextQueryOptions(context.queryClient),
    );

    if (!accessContext.isSuperAdmin) {
      return redirect({ to: "/" });
    }
  },
  component: SuperadminRoute,
});
