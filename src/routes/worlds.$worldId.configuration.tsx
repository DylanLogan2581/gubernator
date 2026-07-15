import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
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
  tab: z.string().optional(),
});

function isKnownConfigTab(tab: string): tab is ConfigTabId {
  return (CONFIG_TAB_IDS as readonly string[]).includes(tab);
}

function parseConfigurationSearch(search: unknown): {
  readonly blueprint?: string;
  readonly tab: ConfigTabId;
} {
  const result = configurationSearchSchema.safeParse(search);
  const rawTab = result.success ? result.data.tab : undefined;
  const tab =
    rawTab !== undefined && isKnownConfigTab(rawTab)
      ? rawTab
      : DEFAULT_CONFIG_TAB;
  const blueprint = result.success ? result.data.blueprint : undefined;
  return { blueprint, tab };
}

function WorldConfigurationRoute(): JSX.Element {
  const { worldId } = Route.useParams();
  const { blueprint, tab } = Route.useSearch();
  const navigate = useNavigate();

  // parseConfigurationSearch silently falls back an unknown `?tab=` to the
  // default tab — this corrects the URL itself instead of leaving a
  // stale/invalid `tab` param displayed while the default tab's content
  // renders underneath it.
  const rawTab = useRouterState({
    select: (state) => new URLSearchParams(state.location.searchStr).get("tab"),
  });

  useEffect(() => {
    if (rawTab === null || isKnownConfigTab(rawTab)) return;
    void navigate({
      to: "/worlds/$worldId/configuration",
      params: { worldId },
      search: { blueprint, tab: DEFAULT_CONFIG_TAB },
      replace: true,
    });
  }, [blueprint, navigate, rawTab, worldId]);

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
