import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  pruneWorldDataMutationOptions,
  setWorldRetentionConfigMutationOptions,
} from "../mutations/superadminMutations";
import { worldRetentionConfigQueryOptions } from "../queries/superadminQueries";

import type {
  PruneWorldDataResult,
  SuperadminWorld,
  WorldRetentionConfig,
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
  const retentionConfigQuery = useQuery(
    worldRetentionConfigQueryOptions(selectedWorldId),
  );

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
    <section className="mt-6">
      <h2 className="border-b border-border pb-2 text-base font-semibold text-seal">
        Data Pruning
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
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
        <div className="mt-4 text-sm">
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

      {selectedWorldId !== "" && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Retention configuration</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Set how many completed turns of data this world keeps automatically.
            Leave a field empty to use the value shown as its placeholder.
          </p>

          {retentionConfigQuery.isPending && (
            <p className="mt-3 text-sm text-muted-foreground">
              Loading current retention…
            </p>
          )}

          {retentionConfigQuery.isError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {getErrorDescription(retentionConfigQuery.error)}
            </p>
          )}

          {retentionConfigQuery.isSuccess && (
            <RetentionConfigFields
              key={selectedWorldId}
              worldId={selectedWorldId}
              config={retentionConfigQuery.data}
            />
          )}
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
    </section>
  );
}

function RetentionConfigFields({
  worldId,
  config,
}: {
  readonly worldId: string;
  readonly config: WorldRetentionConfig;
}): JSX.Element {
  const queryClient = useQueryClient();
  const setRetentionMutation = useMutation(
    setWorldRetentionConfigMutationOptions({ queryClient }),
  );

  const initialLogTurns = toFieldValue(config.logRetentionTurns);
  const initialSnapshotTurns = toFieldValue(config.snapshotRetentionTurns);
  const initialMemoryTurns = toFieldValue(config.memoryRetentionTurns);

  const [logTurns, setLogTurns] = useState(initialLogTurns);
  const [snapshotTurns, setSnapshotTurns] = useState(initialSnapshotTurns);
  const [memoryTurns, setMemoryTurns] = useState(initialMemoryTurns);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isDirty =
    logTurns !== initialLogTurns ||
    snapshotTurns !== initialSnapshotTurns ||
    memoryTurns !== initialMemoryTurns;

  function handleSave(): void {
    const log = parseRetentionField(logTurns);
    const snapshot = parseRetentionField(snapshotTurns);
    const memory = parseRetentionField(memoryTurns);

    if (log === "invalid" || snapshot === "invalid" || memory === "invalid") {
      setFieldError(
        "Each field must be empty (keep all) or a whole number of at least 1.",
      );
      return;
    }
    setFieldError(null);

    setRetentionMutation.mutate(
      {
        logRetentionTurns: log,
        memoryRetentionTurns: memory,
        snapshotRetentionTurns: snapshot,
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Saving retention settings failed");
        },
        onSuccess: () => {
          notifyMutationSuccess("Retention settings saved.");
        },
      },
    );
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="retention-log-turns">Log retention (turns)</Label>
        <Input
          id="retention-log-turns"
          type="number"
          min={1}
          placeholder="200 (default)"
          value={logTurns}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setLogTurns(event.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="retention-snapshot-turns">
          Snapshot retention (turns)
        </Label>
        <Input
          id="retention-snapshot-turns"
          type="number"
          min={1}
          placeholder="200 (default)"
          value={snapshotTurns}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSnapshotTurns(event.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="retention-memory-turns">Memory retention (turns)</Label>
        <Input
          id="retention-memory-turns"
          type="number"
          min={1}
          placeholder="Keep all"
          value={memoryTurns}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setMemoryTurns(event.target.value);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Empty keeps all event memories forever.
        </p>
      </div>

      {fieldError !== null && (
        <p className="text-sm text-destructive sm:col-span-3" role="alert">
          {fieldError}
        </p>
      )}

      <div className="sm:col-span-3">
        <Button
          type="button"
          size="sm"
          disabled={setRetentionMutation.isPending || !isDirty}
          onClick={handleSave}
        >
          Save retention settings
        </Button>
      </div>
    </div>
  );
}

function toFieldValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function parseRetentionField(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1) return "invalid";
  return parsed;
}
