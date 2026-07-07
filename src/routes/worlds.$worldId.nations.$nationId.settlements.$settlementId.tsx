import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { LoadingState } from "@/components/shared/LoadingState";
import { requireAuthenticatedRoute } from "@/features/auth";
import { SettlementDetailPage } from "@/features/settlements";

import type { AnyRedirect } from "@tanstack/react-router";
import type { JSX } from "react";

const legacySearchSchema = z
  .object({ section: z.string().optional() })
  .passthrough();

// Pre-refactor `?section=` values (see docs/ui-redesign.md §4.1) mapped to
// their equivalent child route. Lossy where a section used to bundle
// multiple panels (`economy`, `population`) — each lands on its primary/first
// child route; the others are one sidebar click away. Written as an explicit
// switch (rather than a computed template string) so each `to` stays a
// literal TanStack Router recognizes — a computed path blew up type
// inference (TS2589) across every sibling route file.
function legacySectionRedirect(
  section: string | undefined,
  params: {
    readonly nationId: string;
    readonly settlementId: string;
    readonly worldId: string;
  },
): AnyRedirect | undefined {
  switch (section) {
    case "overview":
      return redirect({
        params,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
      });
    case "population":
      return redirect({
        params,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/citizens",
      });
    case "economy":
      return redirect({
        params,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/buildings",
      });
    case "forecast":
      return redirect({
        params,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/forecast",
      });
    case "reports":
      return redirect({
        params,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/reports",
      });
    case "history":
      return redirect({
        params,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/history",
      });
    case "admin":
      return redirect({
        params,
        to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/settings",
      });
    case undefined:
      return undefined;
    default:
      return undefined;
  }
}

function SettlementDetailRoute(): JSX.Element {
  const { nationId, settlementId, worldId } = Route.useParams();

  return (
    <SettlementDetailPage
      nationId={nationId}
      settlementId={settlementId}
      worldId={worldId}
    >
      <Outlet />
    </SettlementDetailPage>
  );
}

export const Route = createFileRoute(
  "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
)({
  beforeLoad: async ({ context, location, params }) => {
    const authRedirect = await requireAuthenticatedRoute({
      queryClient: context.queryClient,
      returnTo: location.href,
    });
    if (authRedirect !== undefined) {
      return authRedirect;
    }

    const legacySearch = legacySearchSchema.safeParse(location.search);
    const legacyRedirect = legacySectionRedirect(
      legacySearch.success ? legacySearch.data.section : undefined,
      params,
    );
    if (legacyRedirect !== undefined) {
      return legacyRedirect;
    }
  },
  component: SettlementDetailRoute,
  pendingComponent: SettlementDetailPendingRoute,
});

function SettlementDetailPendingRoute(): JSX.Element {
  return <LoadingState label="Checking session…" />;
}
