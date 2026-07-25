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

import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

type LoreImageAvatarProps = {
  readonly aspectClassName: string;
  readonly className?: string;
  readonly interactive?: boolean;
  readonly label: string;
  readonly paletteSeed: string;
  readonly placeholder: LucideIcon;
  readonly url: string | null;
};

// Shared frame for nation/settlement lore imagery (flags, seals) so the
// image-vs-placeholder-fallback and click-to-expand lightbox live in one place
// (#1373). Callers resolve their own signed URL (each image bucket has its own
// signing hook) and pass it in, along with the placeholder glyph, aspect
// ratio, and accessible label. Non-interactive usages (e.g. inside a list-row
// Link) stay a plain decorative image; pass `interactive` to make it a
// lightbox trigger.
export function LoreImageAvatar({
  aspectClassName,
  className,
  interactive = false,
  label,
  paletteSeed,
  placeholder,
  url,
}: LoreImageAvatarProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const PlaceholderIcon = placeholder;

  const frameClassName = cn(
    aspectClassName,
    "overflow-hidden rounded-md border border-border bg-background",
    className,
  );

  const body =
    url !== null ? (
      <img alt="" src={url} className="size-full object-cover" />
    ) : (
      <div
        className={cn(
          "flex size-full items-center justify-center",
          categoricalChipClassName(hashToCategoricalSlot(paletteSeed)),
        )}
      >
        <PlaceholderIcon aria-hidden="true" className="size-4" />
      </div>
    );

  if (!interactive) {
    return (
      <div aria-hidden="true" className={frameClassName}>
        {body}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={`View ${label} full size`}
        className={cn(
          frameClassName,
          "transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        {body}
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {url !== null ? (
            <img
              alt={label}
              src={url}
              className="w-full rounded-md object-contain"
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-md bg-muted",
                aspectClassName,
              )}
            >
              <PlaceholderIcon
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
