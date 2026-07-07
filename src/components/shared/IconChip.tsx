import {
  categoricalChipClassName,
  type CategoricalSlot,
} from "@/lib/categoricalPalette";
import { cn } from "@/lib/utils";

import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

export type IconChipTone =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | CategoricalSlot;

export type IconChipSize = "sm" | "default" | "lg";

const TONE_CLASSNAMES: Record<
  "default" | "success" | "warning" | "destructive",
  string
> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

const SIZE_CLASSNAMES: Record<
  IconChipSize,
  { readonly chip: string; readonly icon: string }
> = {
  sm: { chip: "size-6 rounded-sm", icon: "size-3.5" },
  default: { chip: "size-9 rounded-md", icon: "size-5" },
  lg: { chip: "size-11 rounded-lg", icon: "size-6" },
};

type IconChipProps = {
  readonly icon: LucideIcon;
  readonly tone?: IconChipTone;
  readonly size?: IconChipSize;
  readonly className?: string;
};

/**
 * Icon chip: a lucide icon on a tinted, rounded-square background. Shared
 * across the sidebar, stat tiles, and table name-cells so a domain's icon +
 * color reads the same everywhere (docs/ui-redesign.md §5). `tone` accepts
 * the default/success/warning/destructive set (for state-driven tiles) or a
 * fixed categorical slot 1-8 (for domain identity — see
 * `src/lib/domainIconography.ts`).
 */
export function IconChip({
  icon,
  tone = "default",
  size = "default",
  className,
}: IconChipProps): JSX.Element {
  const Icon = icon;
  const toneClassName =
    typeof tone === "number"
      ? categoricalChipClassName(tone)
      : TONE_CLASSNAMES[tone];
  const sizeSpec = SIZE_CLASSNAMES[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center",
        sizeSpec.chip,
        toneClassName,
        className,
      )}
    >
      <Icon className={sizeSpec.icon} />
    </span>
  );
}
