import { Zap } from "lucide-react";

import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";

import type { LucideIcon } from "lucide-react";

/** Resolves a stored per-event icon name, falling back to the domain Zap icon when unset. */
export function resolveEventIcon(icon: string | null): LucideIcon {
  return icon === null ? Zap : resolveEntityIcon(icon);
}
