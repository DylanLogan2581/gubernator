import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { worldImagesQueryOptions } from "../queries/worldImageQueries";

import { WorldHeroImage } from "./WorldHeroImage";

import type { JSX } from "react";

type WorldDashboardHeroBannerProps = {
  readonly inWorldDateLabel: string;
  readonly isArchived: boolean;
  readonly name: string;
  readonly status: string;
  readonly worldId: string;
};

/**
 * Full-bleed world dashboard hero: a big hero photo (or gradient fallback
 * when unset) that spans edge-to-edge under the top header, with a floating
 * "Back to worlds" button, and the world name, status badge, and in-world
 * date overlaid at the bottom.
 *
 * The negative margins cancel the app main padding (`p-4 lg:p-6`) so the hero
 * escapes the content pane's inset on this one route.
 */
export function WorldDashboardHeroBanner({
  inWorldDateLabel,
  isArchived,
  name,
  status,
  worldId,
}: WorldDashboardHeroBannerProps): JSX.Element {
  const imagesQuery = useQuery(worldImagesQueryOptions(worldId));
  const heroPath = imagesQuery.data?.heroPath ?? null;

  return (
    <section
      aria-labelledby="world-shell-title"
      className="relative -mx-4 -mt-4 h-64 overflow-hidden bg-gradient-to-br from-muted to-muted/40 sm:h-80 md:h-96 lg:-mx-6 lg:-mt-6"
    >
      <WorldHeroImage
        className="absolute inset-0 size-full object-cover"
        heroPath={heroPath}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <Button
        asChild
        variant="outline"
        size="sm"
        className="absolute left-4 top-4 z-10 border-white/30 bg-black/40 text-white backdrop-blur-sm hover:bg-black/55 hover:text-white"
      >
        <Link to="/worlds">
          <ArrowLeft aria-hidden="true" />
          Back to worlds
        </Link>
      </Button>
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
