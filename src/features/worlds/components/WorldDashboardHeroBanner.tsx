import { useQuery } from "@tanstack/react-query";
import { Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { worldImagesQueryOptions } from "../queries/worldImageQueries";

import { WorldHeroImage } from "./WorldHeroImage";

import type { JSX } from "react";

type WorldDashboardHeroBannerProps = {
  readonly inWorldDateLabel: string;
  readonly isArchived: boolean;
  readonly name: string;
  readonly status: string;
  readonly visibility: string;
  readonly worldId: string;
};

/**
 * Compact world dashboard header: a small hero thumbnail (or gradient
 * fallback when unset) beside the world name, status/visibility badges, and
 * in-world date.
 */
export function WorldDashboardHeroBanner({
  inWorldDateLabel,
  isArchived,
  name,
  status,
  visibility,
  worldId,
}: WorldDashboardHeroBannerProps): JSX.Element {
  const imagesQuery = useQuery(worldImagesQueryOptions(worldId));
  const heroPath = imagesQuery.data?.heroPath ?? null;

  return (
    <section
      aria-labelledby="world-shell-title"
      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-muted to-muted/40">
          <WorldHeroImage
            className="absolute inset-0 size-full object-cover"
            heroPath={heroPath}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <h1
            id="world-shell-title"
            className="truncate text-xl font-semibold tracking-normal"
          >
            {name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {status}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {visibility}
            </Badge>
            {isArchived ? (
              <Badge variant="secondary">
                <Archive className="size-3" aria-hidden="true" />
                Read-only archive
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
      <p className="shrink-0 text-sm text-muted-foreground">
        {inWorldDateLabel}
      </p>
    </section>
  );
}
