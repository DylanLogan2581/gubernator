import {
  ArrowLeftRight,
  Building2,
  Gem,
  HardHat,
  Package,
  PawPrint,
  Users,
  Zap,
} from "lucide-react";

import type { IconChipTone } from "@/components/shared/IconChip";

import type { LucideIcon } from "lucide-react";

export type DomainKey =
  | "citizens"
  | "buildings"
  | "stockpiles"
  | "populations"
  | "deposits"
  | "construction"
  | "trade"
  | "events";

type DomainIconSpec = {
  readonly icon: LucideIcon;
  readonly tone: IconChipTone;
};

/**
 * One fixed icon + categorical color per domain (docs/ui-redesign.md §5.5),
 * shared by the sidebar, stat tiles, and table name-cells so a domain reads
 * the same everywhere. Slot assignment is a first pass against the dataviz
 * skill's default 8-hue set — swap freely, this is the only place to do it.
 * Reports and Turn Log are cross-cutting log views rather than an "entity
 * class", so they keep the neutral default IconChip tone instead of a 9th
 * hue (see their call sites).
 */
export const DOMAIN_ICON_CHIPS: Record<DomainKey, DomainIconSpec> = {
  citizens: { icon: Users, tone: 1 },
  buildings: { icon: Building2, tone: 2 },
  stockpiles: { icon: Package, tone: 3 },
  populations: { icon: PawPrint, tone: 4 },
  deposits: { icon: Gem, tone: 5 },
  construction: { icon: HardHat, tone: 6 },
  trade: { icon: ArrowLeftRight, tone: 7 },
  events: { icon: Zap, tone: 8 },
};
