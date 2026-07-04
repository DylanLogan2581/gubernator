import { useMutation } from "@tanstack/react-query";
import { useState, type ChangeEvent, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { pruneWorldDataMutationOptions } from "../mutations/superadminMutations";

import type {
  PruneWorldDataResult,
  SuperadminWorld,
} from "../types/superadminTypes";

type PruneWorldDataPanelProps = {
  readonly worlds: readonly SuperadminWorld[];
};

export function PruneWorldDataPanel({
  worlds,
}: PruneWorldDataPanelProps): JSX.Element {
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const [retentionTurns, setRetentionTurns] = useState<number>(100);
  const [preview, setPreview] = useState<PruneWorldDataResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const pruneMutation = useMutation(pruneWorldDataMutationOptions({}));

  const selectedWorld = worlds.find((w) => w.id === selectedWorldId) ?? null;

  function handleRetentionChange(e: ChangeEvent<HTMLInputElement>): void {
    const parsed = parseInt(e.target.value, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      setRetentionTurns(parsed);
    }
  }

  function handlePreview(): void {
    if (selectedWorldId === "") return;
    pruneMutation.mutate(
      { worldId: selectedWorldId, retentionTurns, dryRun: true },
      {
        onSuccess: (result) => {
          setPreview(result);
        },
        onError: (error) => {
          notifyMutationError(error, "Preview failed");
        },
      },
    );
  }

  function handleConfirmPrune(): void {
    if (selectedWorldId === "") return;
    pruneMutation.mutate(
      { worldId: selectedWorldId, retentionTurns, dryRun: false },
      {
        onSuccess: (result) => {
          setPreview(null);
          setConfirmOpen(false);
          notifyMutationSuccess(
            `Pruned ${result.snapshots_deleted.toString()} snapshots and ${result.log_entries_deleted.toString()} log entries.`,
          );
        },
        onError: (error) => {
          setConfirmOpen(false);
          notifyMutationError(error, "Prune failed");
        },
      },
    );
  }

  const confirmDescription = preview !== null && (
    <span>
      This will permanently delete:
      <ul className="mt-2 list-disc pl-5 text-sm">
        <li>
          <strong>{preview.snapshots_deleted}</strong> settlement snapshots
        </li>
        <li>
          <strong>{preview.resource_snapshots_deleted}</strong> resource
          snapshots
        </li>
        <li>
          <strong>{preview.log_entries_deleted}</strong> turn log entries
        </li>
      </ul>
      <p className="mt-2 text-sm text-muted-foreground">
        Turns {preview.cutoff_turn}–{preview.current_turn} will be retained.
        This cannot be undone.
      </p>
    </span>
  );

  return (
    <div className="mt-6 rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold">Data Pruning</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Remove old snapshots and turn logs beyond a retention window. Superadmin
        only. The latest turn and its transition logs are always retained.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prune-world-select">World</Label>
          <Select
            value={selectedWorldId}
            onValueChange={(value) => {
              setSelectedWorldId(value);
              setPreview(null);
            }}
          >
            <SelectTrigger id="prune-world-select" className="w-56">
              <SelectValue placeholder="Select a world…" />
            </SelectTrigger>
            <SelectContent>
              {worlds.map((world) => (
                <SelectItem key={world.id} value={world.id}>
                  {world.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prune-retention-turns">Retain last N turns</Label>
          <Input
            id="prune-retention-turns"
            type="number"
            min={1}
            value={retentionTurns}
            onChange={handleRetentionChange}
            className="w-28"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selectedWorldId === "" || pruneMutation.isPending}
          onClick={handlePreview}
        >
          Preview
        </Button>

        {preview !== null && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pruneMutation.isPending}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Prune
          </Button>
        )}
      </div>

      {preview !== null && (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">
            Preview for &ldquo;{selectedWorld?.name ?? selectedWorldId}&rdquo;
          </p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>
              Eligible settlement snapshots:{" "}
              <span className="font-semibold text-foreground">
                {preview.snapshots_deleted}
              </span>
            </li>
            <li>
              Eligible resource snapshots:{" "}
              <span className="font-semibold text-foreground">
                {preview.resource_snapshots_deleted}
              </span>
            </li>
            <li>
              Eligible turn log entries:{" "}
              <span className="font-semibold text-foreground">
                {preview.log_entries_deleted}
              </span>
            </li>
            <li>
              Turns retained: {preview.cutoff_turn}–{preview.current_turn}
            </li>
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Prune world data?"
        description={confirmDescription !== false ? confirmDescription : ""}
        confirmLabel="Prune"
        confirmVariant="destructive"
        isPending={pruneMutation.isPending}
        onConfirm={handleConfirmPrune}
      />
    </div>
  );
}
