import { Landmark } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  categoricalChipClassName,
  hashToCategoricalSlot,
} from "@/lib/categoricalPalette";
import { cn } from "@/lib/utils";

import { useNationImageSignedUrl } from "../queries/nationImageQueries";

import type { JSX } from "react";

type NationFlagAvatarProps = {
  readonly className?: string;
  readonly flagPath: string | null;
  readonly interactive?: boolean;
  readonly nationId: string;
  readonly nationName?: string;
};

// Shared by the nation list and the nation detail header so the
// flag-vs-placeholder-fallback logic lives in one place (#1072). Falls back
// to a landmark glyph whenever there's no flag yet or its signed URL hasn't
// resolved. Rectangular (flags aren't circular avatars, #1161) -- pass
// `interactive` (with `nationName` for the accessible label/dialog title) to
// make the flag a click-to-expand lightbox trigger; non-interactive usages
// (e.g. inside a nation list row `Link`) stay a plain decorative image.
export function NationFlagAvatar({
  className,
  flagPath,
  interactive = false,
  nationId,
  nationName,
}: NationFlagAvatarProps): JSX.Element {
  const { url } = useNationImageSignedUrl(flagPath);
  const [isOpen, setIsOpen] = useState(false);

  const flagFrameClassName = cn(
    "aspect-[3/2] overflow-hidden rounded-md border border-border bg-background",
    className,
  );

  const flagBody =
    url !== null ? (
      <img alt="" src={url} className="size-full object-cover" />
    ) : (
      <div
        className={cn(
          "flex size-full items-center justify-center",
          categoricalChipClassName(hashToCategoricalSlot(nationId)),
        )}
      >
        <Landmark aria-hidden="true" className="size-4" />
      </div>
    );

  if (!interactive) {
    return (
      <div aria-hidden="true" className={flagFrameClassName}>
        {flagBody}
      </div>
    );
  }

  const dialogTitle = `${nationName ?? "Nation"} flag`;

  return (
    <>
      <button
        type="button"
        aria-label={`View ${dialogTitle} full size`}
        className={cn(
          flagFrameClassName,
          "transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        {flagBody}
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          {url !== null ? (
            <img
              alt={dialogTitle}
              src={url}
              className="w-full rounded-md object-contain"
            />
          ) : (
            <div className="flex aspect-[3/2] items-center justify-center rounded-md bg-muted">
              <Landmark
                aria-hidden="true"
                className="size-8 text-muted-foreground"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
