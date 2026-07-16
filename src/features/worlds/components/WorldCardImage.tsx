import { Globe2 } from "lucide-react";

import {
  categoricalChipClassName,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";

import { useWorldImageSignedUrl } from "../queries/worldImageQueries";

import type { AccessibleWorld } from "../types/worldTypes";
import type { JSX } from "react";

type WorldCardImageProps = {
  readonly world: AccessibleWorld;
};

// Banner-style image for a world card in the /worlds list: bigger than the
// old size-10 avatar so the world's photo actually reads as a photo (#1221).
// Falls back to a categorical color chip with a globe glyph when the world
// has no thumbnail yet.
export function WorldCardImage({ world }: WorldCardImageProps): JSX.Element {
  const { url } = useWorldImageSignedUrl(world.heroPath);
  const initial = world.name.trim().charAt(0).toUpperCase();

  return (
    <div
      className={
        url !== null
          ? "relative h-32 w-full shrink-0 overflow-hidden sm:h-36"
          : `relative flex h-32 w-full shrink-0 items-center justify-center overflow-hidden text-2xl font-semibold sm:h-36 ${categoricalChipClassName(hashToCategoricalSlot(world.id))}`
      }
    >
      {url !== null ? (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          src={url}
        />
      ) : initial === "" ? (
        <Globe2 className="size-8 opacity-70" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </div>
  );
}
