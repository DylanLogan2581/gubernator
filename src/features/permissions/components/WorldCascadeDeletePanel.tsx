import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hardDeleteWorldMutationOptions } from "@/features/worlds";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { previewWorldDeleteMutationOptions } from "../mutations/superadminMutations";
import { trashedWorldsForSuperadminQueryOptions } from "../queries/superadminQueries";

import type { PreviewWorldDeleteResult } from "../types/superadminTypes";

export function WorldCascadeDeletePanel(): JSX.Element {
  const queryClient = useQueryClient();
  const worldsQuery = useQuery(trashedWorldsForSuperadminQueryOptions());
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const [preview, setPreview] = useState<PreviewWorldDeleteResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const previewMutation = useMutation(previewWorldDeleteMutationOptions({}));
  const deleteMutation = useMutation(
    hardDeleteWorldMutationOptions({ queryClient }),
  );

  const worlds = worldsQuery.data ?? [];
  const selectedWorld = worlds.find((w) => w.id === selectedWorldId) ?? null;
  const isPending = previewMutation.isPending || deleteMutation.isPending;

  function handlePreview(): void {
    if (selectedWorldId === "") return;
    previewMutation.mutate(selectedWorldId, {
      onSuccess: (result) => {
        setPreview(result);
      },
      onError: (error) => {
        notifyMutationError(error, "Preview failed");
      },
    });
  }

  function handleConfirmDelete(): void {
    if (selectedWorldId === "") return;
    deleteMutation.mutate(
      { worldId: selectedWorldId },
      {
        onSuccess: () => {
          setPreview(null);
          setConfirmOpen(false);
          setSelectedWorldId("");
          notifyMutationSuccess("World permanently deleted.");
        },
        onError: (error) => {
          setConfirmOpen(false);
          notifyMutationError(error, "Delete failed");
        },
      },
    );
  }

  const confirmDescription = preview !== null && (
    <span>
      <p>
        This will permanently delete{" "}
        <strong>&ldquo;{preview.worldName}&rdquo;</strong> and all dependent
        data. This cannot be undone.
      </p>
      <ul className="mt-2 list-disc pl-5 text-sm">
        {preview.nations > 0 && (
          <li>
            <strong>{preview.nations}</strong> nation
            {preview.nations !== 1 ? "s" : ""}
          </li>
        )}
        {preview.settlements > 0 && (
          <li>
            <strong>{preview.settlements}</strong> settlement
            {preview.settlements !== 1 ? "s" : ""}
          </li>
        )}
        {preview.citizens > 0 && (
          <li>
            <strong>{preview.citizens}</strong> citizen
            {preview.citizens !== 1 ? "s" : ""}
          </li>
        )}
        {preview.turnTransitions > 0 && (
          <li>
            <strong>{preview.turnTransitions}</strong> turn transition
            {preview.turnTransitions !== 1 ? "s" : ""}
          </li>
        )}
        {preview.worldAdmins > 0 && (
          <li>
            <strong>{preview.worldAdmins}</strong> world admin
            {preview.worldAdmins !== 1 ? "s" : ""}
          </li>
        )}
      </ul>
    </span>
  );

  return (
    <div className="mt-6 rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold">World Hard Delete</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Permanently delete a trashed world and all cascade-dependent data.
        Preview counts before confirming. Superadmin only.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <Select
          value={selectedWorldId}
          onValueChange={(value) => {
            setSelectedWorldId(value);
            setPreview(null);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select a trashed world…" />
          </SelectTrigger>
          <SelectContent>
            {worlds.map((world) => (
              <SelectItem key={world.id} value={world.id}>
                {world.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={selectedWorldId === "" || isPending}
          onClick={handlePreview}
        >
          Preview cascade
        </Button>

        {preview !== null && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            Delete world
          </Button>
        )}
      </div>

      {worldsQuery.isError && (
        <p className="mt-2 text-sm text-destructive">
          Could not load trashed worlds.
        </p>
      )}

      {preview !== null && (
        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">
            Cascade preview for &ldquo;
            {selectedWorld?.name ?? selectedWorldId}&rdquo;
          </p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>
              Nations:{" "}
              <span className="font-semibold text-foreground">
                {preview.nations}
              </span>
            </li>
            <li>
              Settlements:{" "}
              <span className="font-semibold text-foreground">
                {preview.settlements}
              </span>
            </li>
            <li>
              Citizens:{" "}
              <span className="font-semibold text-foreground">
                {preview.citizens}
              </span>
            </li>
            <li>
              Resources:{" "}
              <span className="font-semibold text-foreground">
                {preview.resources}
              </span>
            </li>
            <li>
              Turn transitions:{" "}
              <span className="font-semibold text-foreground">
                {preview.turnTransitions}
              </span>
            </li>
            <li>
              Event groups:{" "}
              <span className="font-semibold text-foreground">
                {preview.eventGroups}
              </span>
            </li>
            <li>
              World admins:{" "}
              <span className="font-semibold text-foreground">
                {preview.worldAdmins}
              </span>
            </li>
            <li>
              Notifications:{" "}
              <span className="font-semibold text-foreground">
                {preview.notifications}
              </span>
            </li>
            <li>
              Settlement snapshots:{" "}
              <span className="font-semibold text-foreground">
                {preview.settlementTurnSnapshots}
              </span>
            </li>
            <li>
              Turn log entries:{" "}
              <span className="font-semibold text-foreground">
                {preview.turnLogEntries}
              </span>
            </li>
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Permanently delete world?"
        description={confirmDescription !== false ? confirmDescription : ""}
        confirmLabel="Delete world"
        confirmVariant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
