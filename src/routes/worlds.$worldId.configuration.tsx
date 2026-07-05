import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { requireAuthenticatedRoute } from "@/features/auth";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import {
  CONFIG_TAB_IDS,
  DEFAULT_CONFIG_TAB,
  WorldConfigurationPage,
  isWorldNotFoundError,
  worldRouteAccessQueryOptions,
} from "@/features/worlds";
import type { ConfigTabId } from "@/features/worlds";

import type { JSX } from "react";

const configurationSearchSchema = z.object({
  blueprint: z.string().optional(),
  tab: z.enum(CONFIG_TAB_IDS).optional(),
});

function parseConfigurationSearch(search: unknown): {
  readonly blueprint?: string;
  readonly tab: ConfigTabId;
} {
  const result = configurationSearchSchema.safeParse(search);
  const tab = result.success
    ? (result.data.tab ?? DEFAULT_CONFIG_TAB)
    : DEFAULT_CONFIG_TAB;
  const blueprint = result.success ? result.data.blueprint : undefined;
  return { blueprint, tab };
}

function WorldConfigurationRoute(): JSX.Element {
  const { worldId } = Route.useParams();
  const { blueprint, tab } = Route.useSearch();
  return (
    <WorldConfigurationPage
      activeTab={tab}
      selectedBlueprintId={blueprint}
      worldId={worldId}
    />
  );
}

export const Route = createFileRoute("/worlds/$worldId/configuration")({
  beforeLoad: async ({ context, location, params }) => {
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

    try {
      const worldAccess = await context.queryClient.ensureQueryData(
        worldRouteAccessQueryOptions(params.worldId, accessContext),
      );

      if (!worldAccess.canAdmin) {
        return redirect({
          params: { worldId: params.worldId },
          to: "/worlds/$worldId",
        });
      }

      // Admin capability may still be suppressed by an active player
      // character (see useEffectiveCanAdmin) — that case is handled by
      // WorldConfigurationPage itself, which explains the suppression
      // instead of silently bouncing the viewer back.
    } catch (error) {
      if (!isWorldNotFoundError(error)) {
        throw error;
      }
    }
  },
  component: WorldConfigurationRoute,
  validateSearch: parseConfigurationSearch,
});
