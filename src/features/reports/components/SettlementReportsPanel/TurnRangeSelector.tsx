import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TurnRangeSelectorProps = {
  readonly fromTurn: number;
  readonly toTurn: number;
  readonly onApply: (fromTurn: number, toTurn: number) => void;
};

const MAX_RANGE = 50;

export function TurnRangeSelector({
  fromTurn,
  toTurn,
  onApply,
}: TurnRangeSelectorProps): JSX.Element {
  const [draftFrom, setDraftFrom] = useState(String(fromTurn));
  const [draftTo, setDraftTo] = useState(String(toTurn));
  const [error, setError] = useState<string | null>(null);
  const [clampHint, setClampHint] = useState<string | null>(null);

  function handleApply(): void {
    const parsedFrom = parseInt(draftFrom, 10);
    const parsedTo = parseInt(draftTo, 10);
    const from = Math.max(1, isNaN(parsedFrom) ? 1 : parsedFrom);
    const to = isNaN(parsedTo) ? from : parsedTo;

    if (to < from) {
      setError(
        `"From" turn must not exceed "To" turn (got ${String(from)} → ${String(to)}).`,
      );
      setClampHint(null);
      return;
    }
    setError(null);

    const clampedTo = Math.min(to, from + MAX_RANGE - 1);
    if (clampedTo < to) {
      setClampHint(
        `"To" clamped to turn ${String(clampedTo)} (max ${String(MAX_RANGE)} turns per query).`,
      );
    } else {
      setClampHint(null);
    }

    setDraftFrom(String(from));
    setDraftTo(String(clampedTo));
    onApply(from, clampedTo);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === "Enter") {
      handleApply();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="from-turn">From turn</Label>
          <Input
            id="from-turn"
            type="number"
            min={1}
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="to-turn">To turn</Label>
          <Input
            id="to-turn"
            type="number"
            min={1}
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-24"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleApply}>
          Apply
        </Button>
        <p className="self-end pb-1 text-xs text-muted-foreground">
          Max {MAX_RANGE} turns per query.
        </p>
      </div>
      {error !== null && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {clampHint !== null && (
        <p className="text-xs text-muted-foreground">{clampHint}</p>
      )}
    </div>
  );
}
