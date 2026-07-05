import { useQuery } from "@tanstack/react-query";
import { Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  useWorldImageSignedUrl,
  worldImagesQueryOptions,
} from "../queries/worldImageQueries";

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
 * World dashboard header: hero image (or gradient fallback when unset) with
 * the world name, status/visibility badges, and in-world date overlaid.
 * Replaces the plain identity `<dl>` that used to sit above the stat tiles.
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
  const { url } = useWorldImageSignedUrl(heroPath);
  const hasImage = url !== null;

  return (
    <section
      aria-labelledby="world-shell-title"
      className="relative isolate min-h-48 overflow-hidden rounded-md border border-border bg-gradient-to-br from-muted to-muted/40"
    >
      <WorldHeroImage
        className="absolute inset-0 size-full object-cover"
        heroPath={heroPath}
      />
      {hasImage ? (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      ) : null}
      <div className="absolute inset-0 flex flex-col justify-end gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1
            id="world-shell-title"
            className={cn(
              "text-2xl font-semibold tracking-normal",
              hasImage && "text-white",
            )}
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
        <p
          className={cn(
            "text-sm",
            hasImage ? "text-white/90" : "text-muted-foreground",
          )}
        >
          {inWorldDateLabel}
        </p>
      </div>
    </section>
  );
}
