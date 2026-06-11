import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

type AssignmentCountControlProps = {
  readonly capacity?: number | null;
  readonly currentCount: number;
  readonly label: string;
  readonly onApply: (
    parsedCount: number,
  ) => Promise<{ readonly after: number }>;
  readonly successMessage: string;
  readonly unassignedNpcCount: number;
};

export function AssignmentCountControl({
  capacity,
  currentCount,
  label,
  onApply,
  successMessage,
  unassignedNpcCount,
}: AssignmentCountControlProps): JSX.Element {
  const [localCount, setLocalCount] = useState(String(currentCount));
  const [isApplying, setIsApplying] = useState(false);

  const parsedCount = parseInt(localCount, 10);
  const isValid = !Number.isNaN(parsedCount) && parsedCount >= 0;
  const isDirty = isValid && parsedCount !== currentCount;
  const isRaising = isValid && parsedCount > currentCount;
  const atCapacity =
    capacity !== null &&
    capacity !== undefined &&
    isValid &&
    parsedCount > capacity;
  const noNpcs = isRaising && unassignedNpcCount === 0;
  const applyDisabled = isApplying || !isDirty || atCapacity || noNpcs;

  const applyTooltip = atCapacity
    ? `Maximum workers is ${capacity?.toString()}`
    : noNpcs
      ? "No unassigned NPCs available"
      : undefined;

  async function handleApply(): Promise<void> {
    if (!isValid) return;
    setIsApplying(true);
    try {
      const result = await onApply(parsedCount);
      setLocalCount(String(result.after));
      notifyMutationSuccess(successMessage);
    } catch (error) {
      notifyMutationError(error, "Failed to update assignment.");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label={`Target count for ${label}`}
        className="w-20"
        disabled={isApplying}
        inputMode="numeric"
        min="0"
        type="number"
        value={localCount}
        onChange={(e) => {
          setLocalCount(e.currentTarget.value);
        }}
      />
      <span title={applyTooltip}>
        <Button
          disabled={applyDisabled}
          size="sm"
          type="button"
          onClick={() => {
            void handleApply();
          }}
        >
          Apply
        </Button>
      </span>
    </div>
  );
}
