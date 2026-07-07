import { Landmark } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  categoricalChipClassName,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";

import { useNationImageSignedUrl } from "../queries/nationImageQueries";

import type { JSX } from "react";

type NationFlagAvatarProps = {
  readonly className?: string;
  readonly flagPath: string | null;
  readonly nationId: string;
  readonly size?: "default" | "lg" | "sm";
};

// Shared by the nation list and the nation detail header so the
// flag-vs-placeholder-fallback logic lives in one place (#1072). Falls back
// to a landmark glyph whenever there's no flag yet or its signed URL hasn't
// resolved. Mirrors src/features/worlds/components/WorldAvatar.tsx.
export function NationFlagAvatar({
  className,
  flagPath,
  nationId,
  size = "default",
}: NationFlagAvatarProps): JSX.Element {
  const { url } = useNationImageSignedUrl(flagPath);

  return (
    <Avatar aria-hidden="true" className={className} size={size}>
      {url !== null ? <AvatarImage src={url} alt="" /> : null}
      <AvatarFallback
        className={categoricalChipClassName(hashToCategoricalSlot(nationId))}
      >
        <Landmark className="size-4" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  );
}
