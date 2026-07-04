import { Globe2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  categoricalChipClassName,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";

import { useWorldImageSignedUrl } from "../queries/worldImageQueries";

import type { JSX } from "react";

type WorldAvatarProps = {
  readonly className?: string;
  readonly size?: "default" | "lg" | "sm";
  readonly thumbnailPath: string | null;
  readonly worldId: string;
  readonly worldName: string;
};

// Shared by the world list, the sidebar world switcher, and the command
// palette so the thumbnail-vs-letter-fallback logic lives in one place
// (#1008). Falls back to the world's initial (then a globe glyph) whenever
// there's no thumbnail yet or its signed URL hasn't resolved.
export function WorldAvatar({
  className,
  size = "default",
  thumbnailPath,
  worldId,
  worldName,
}: WorldAvatarProps): JSX.Element {
  const { url } = useWorldImageSignedUrl(thumbnailPath);
  const initial = worldName.trim().charAt(0).toUpperCase();

  return (
    <Avatar aria-hidden="true" className={className} size={size}>
      {url !== null ? <AvatarImage src={url} alt="" /> : null}
      <AvatarFallback
        className={categoricalChipClassName(hashToCategoricalSlot(worldId))}
      >
        {initial === "" ? (
          <Globe2 className="size-4" aria-hidden="true" />
        ) : (
          initial
        )}
      </AvatarFallback>
    </Avatar>
  );
}
