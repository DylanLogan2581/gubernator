import { CheckCircle2, ClipboardList, ScrollText, Zap } from "lucide-react";

import { IconChip } from "@/components/shared/IconChip";
import type { CategoricalSlot } from "@/lib/categoricalPalette";

import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

type TurnStep = {
  readonly icon: LucideIcon;
  readonly tone: CategoricalSlot;
  readonly title: string;
  readonly description: string;
};

const TURN_STEPS: readonly TurnStep[] = [
  {
    icon: ClipboardList,
    tone: 1,
    title: "Plan",
    description: "Assign jobs, buildings, and trade routes for the turn ahead.",
  },
  {
    icon: CheckCircle2,
    tone: 3,
    title: "Mark ready",
    description: "Settlement and nation managers confirm their orders are set.",
  },
  {
    icon: Zap,
    tone: 8,
    title: "Simulate",
    description:
      "The world advances together: production, growth, trade, and events resolve.",
  },
  {
    icon: ScrollText,
    tone: 6,
    title: "Outcome",
    description:
      "Turn logs, reports, and notifications explain exactly what changed.",
  },
] as const;

/**
 * "How a turn works" strip — mirrors the real readiness/turn model (plan,
 * mark ready, simulate, outcome) rather than inventing new terminology.
 */
export function HomeTurnCycleSection(): JSX.Element {
  return (
    <section aria-label="How a turn works" className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">How a turn works</h2>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TURN_STEPS.map(({ icon, tone, title, description }, index) => (
          <li
            key={title}
            className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="flex items-center gap-2">
              <IconChip icon={icon} tone={tone} />
              <span className="text-sm text-muted-foreground">
                Step {index + 1}
              </span>
            </div>
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
