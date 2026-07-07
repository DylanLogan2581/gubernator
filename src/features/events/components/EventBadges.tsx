import {
  Building2,
  CheckCircle2,
  Clock,
  Flag,
  Globe,
  History,
  XCircle,
} from "lucide-react";

import { Badge, type badgeVariants } from "@/components/ui/badge";

import type { EventScopeType, EventStatus } from "../types/eventTypes";
import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const STATUS_META: Record<
  EventStatus,
  {
    readonly label: string;
    readonly icon: LucideIcon;
    readonly variant?: BadgeVariant;
    readonly className?: string;
  }
> = {
  active: { label: "Active", icon: CheckCircle2, variant: "success" },
  pending: { label: "Pending", icon: Clock, variant: "warning" },
  expired: { label: "Expired", icon: History, variant: "secondary" },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "destructive" },
};

const SCOPE_META: Record<
  EventScopeType,
  { readonly label: string; readonly icon: LucideIcon }
> = {
  world: { label: "World", icon: Globe },
  nation: { label: "Nation", icon: Flag },
  settlement: { label: "Settlement", icon: Building2 },
};

export function EventStatusBadge({
  status,
}: {
  readonly status: EventStatus;
}): JSX.Element {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <Badge variant={meta.variant} className={meta.className}>
      <Icon aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}

export function EventScopeBadge({
  scopeType,
}: {
  readonly scopeType: EventScopeType;
}): JSX.Element {
  const meta = SCOPE_META[scopeType];
  const Icon = meta.icon;

  return (
    <Badge variant="outline">
      <Icon aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}
