import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settlementsByWorldQueryOptions } from "@/features/settlements";

import { computeEffectImpact } from "../../../utils/effectImpact";

import type { EffectData, EffectScopeType } from "./Types";
import type { JSX } from "react";

/**
 * Inline "zero targets" warning shared by every sub-editor. Resolves the
 * effect's live target count (settlement scope resolved from world settlements,
 * plus a caller-supplied live deposit count for deposit-type mode) and renders
 * a destructive alert only when the effect currently resolves to 0 targets.
 */
export function ZeroTargetAlert({
  effect,
  worldId,
  scopeType,
  selectedIds,
  matchingDepositCount,
}: {
  readonly effect: EffectData;
  readonly worldId: string;
  readonly scopeType: EffectScopeType;
  readonly selectedIds: string[];
  readonly matchingDepositCount?: number;
}): JSX.Element | null {
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));

  const effectImpact =
    scopeType !== null
      ? computeEffectImpact(
          { ...effect, matchingDepositCount },
          scopeType,
          selectedIds,
          settlementsQuery.data ?? [],
        )
      : null;

  if (effectImpact === null || effectImpact.count !== 0) return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Zero targets</AlertTitle>
      <AlertDescription>
        This effect currently resolves to 0 targets and will have no effect.
        Review scope and effect configuration.
      </AlertDescription>
    </Alert>
  );
}

/** Flat-amount / percent-of-current radio toggle used by amount effects. */
export function AmountModeToggle({
  effect,
  onUpdate,
}: {
  readonly effect: EffectData;
  readonly onUpdate: (updated: EffectData) => void;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <Label>Mode</Label>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={!effect.isPercent}
            onChange={() => onUpdate({ ...effect, isPercent: false })}
          />
          <span className="text-sm">Flat amount</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={effect.isPercent}
            onChange={() => onUpdate({ ...effect, isPercent: true })}
          />
          <span className="text-sm">Percent of current</span>
        </label>
      </div>
    </div>
  );
}

/** Multiplier label + numeric input shared by the multiplier effects. */
export function MultiplierInput({
  effect,
  index,
  onUpdate,
}: {
  readonly effect: EffectData;
  readonly index: number;
  readonly onUpdate: (updated: EffectData) => void;
}): JSX.Element {
  return (
    <>
      <Label htmlFor={`multiplier-${index}-${effect.effectType}`}>
        Multiplier (e.g., 1.2 for 20% increase, 0.8 for 20% decrease)
      </Label>
      <Input
        id={`multiplier-${index}-${effect.effectType}`}
        type="number"
        placeholder="1.0"
        step="0.1"
        value={effect.multiplierValue ?? ""}
        onChange={(e) =>
          onUpdate({
            ...effect,
            multiplierValue:
              e.target.value !== "" ? parseFloat(e.target.value) : null,
          })
        }
      />
    </>
  );
}
