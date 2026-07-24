import { Badge, type badgeVariants } from "@/components/ui/badge";

import type { VariantProps } from "class-variance-authority";
import type { JSX, ReactNode } from "react";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

export type StatusBadgeConfigEntry = {
  readonly label: string;
  readonly variant?: BadgeVariant;
  readonly icon?: ReactNode;
};

type StatusBadgeProps<TStatus extends string> = {
  readonly status: TStatus;
  /** Maps each status value to its label, badge variant, and optional icon. */
  readonly config: Record<TStatus, StatusBadgeConfigEntry>;
  /** Prefix prepended to the label, e.g. a route name before "Approved". */
  readonly labelPrefix?: string;
  readonly title?: string;
  readonly className?: string;
};

/**
 * Generic status → variant/label badge. Feed it a `config` record keyed by the
 * status union and it renders the matching Badge, with an optional leading
 * prefix and trailing icon. Replaces per-domain status badges that each hand-
 * rolled the same status→variant/label mapping (trade route status/approval,
 * …); reach for this instead of copying the next one.
 */
export function StatusBadge<TStatus extends string>({
  status,
  config,
  labelPrefix,
  title,
  className,
}: StatusBadgeProps<TStatus>): JSX.Element {
  const { label, variant, icon } = config[status];

  return (
    <Badge className={className} title={title} variant={variant}>
      <span>
        {labelPrefix === undefined ? label : `${labelPrefix} ${label}`}
      </span>
      {icon}
    </Badge>
  );
}
