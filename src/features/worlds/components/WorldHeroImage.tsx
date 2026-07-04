import { useWorldImageSignedUrl } from "../queries/worldImageQueries";

import type { JSX } from "react";

type WorldHeroImageProps = {
  readonly className?: string;
  readonly heroPath: string | null;
};

// Resolves a world's hero_path to its signed URL and renders the banner
// image, or nothing when no hero image is set — the caller supplies whatever
// fallback background it wants (#1008; wired into the dashboard header by a
// follow-up issue).
export function WorldHeroImage({
  className,
  heroPath,
}: WorldHeroImageProps): JSX.Element | null {
  const { url } = useWorldImageSignedUrl(heroPath);

  if (url === null) {
    return null;
  }

  return <img alt="" aria-hidden="true" className={className} src={url} />;
}
