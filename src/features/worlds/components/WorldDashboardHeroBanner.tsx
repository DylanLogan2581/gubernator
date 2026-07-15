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
 * Full-width world dashboard header: a big hero photo (or gradient fallback
 * when unset) with the world name, status/visibility badges, and in-world
 * date overlaid at the bottom.
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
      className="relative h-48 w-full overflow-hidden rounded-md border border-border bg-gradient-to-br from-muted to-muted/40 sm:h-64 md:h-80"
    >
      <WorldHeroImage
        className="absolute inset-0 size-full object-cover"
        heroPath={heroPath}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <h1
            id="world-shell-title"
            className="truncate text-2xl font-semibold tracking-normal text-white drop-shadow-sm sm:text-3xl"
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
        <p className="shrink-0 text-sm text-white/90">{inWorldDateLabel}</p>
      </div>
    </section>
  );
}
