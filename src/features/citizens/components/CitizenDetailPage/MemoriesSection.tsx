import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  resolveTurnCalendarDate,
  worldCalendarConfigQueryOptions,
  WorldDatePicker,
} from "@/features/calendar";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  createCitizenMemoryMutationOptions,
  deleteCitizenMemoryMutationOptions,
  updateCitizenMemoryMutationOptions,
} from "../../mutations/citizenMemoriesMutations";
import {
  citizenMemoriesQueryOptions,
  type CitizenMemory,
} from "../../queries/citizenMemoriesQueries";

// ---- helpers ------------------------------------------------------------

function memorySourceLabel(source: string): string {
  return source === "manual" ? "Manual" : "Event";
}

function turnNumberToCalendarDate(
  config: unknown,
  turnNumber: number | null,
): { dayOfMonth: number; monthIndex: number; year: number } | null {
  if (config === null || config === undefined || turnNumber === null) {
    return null;
  }
  try {
    const resolved = resolveTurnCalendarDate(
      config as Parameters<typeof resolveTurnCalendarDate>[0],
      turnNumber,
    );
    return {
      year: resolved.year,
      monthIndex: resolved.monthIndex,
      dayOfMonth: resolved.dayOfMonth,
    };
  } catch {
    return null;
  }
}

// ---- add form -----------------------------------------------------------

function AddMemoryForm({
  citizenId,
  currentTurnNumber,
  onCancel,
  onSuccess,
  queryClient,
  worldId,
}: {
  readonly citizenId: string;
  readonly currentTurnNumber: number;
  readonly onCancel: () => void;
  readonly onSuccess: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));
  const createMutation = useMutation(
    createCitizenMemoryMutationOptions({ queryClient }),
  );

  const calendarConfig = calendarQuery.data ?? null;

  const [text, setText] = useState("");
  const [turnNumber, setTurnNumber] = useState<number | null>(
    currentTurnNumber,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (turnNumber === null) return;

    createMutation.mutate(
      {
        citizenId,
        memoryText: text,
        occurredOnTurnNumber: turnNumber,
        worldId,
      },
      {
        onError: (error) => notifyMutationError(error, "Failed to add memory."),
        onSuccess: () => {
          notifyMutationSuccess("Memory added.");
          onSuccess();
        },
      },
    );
  }

  if (calendarQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading calendar…</p>;
  }

  if (calendarQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Calendar configuration unavailable.
      </p>
    );
  }

  return (
    <form
      aria-label="Add memory"
      className="grid gap-3"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="grid gap-1 text-sm">
        <Label htmlFor="memory-date">Date</Label>
        {calendarConfig !== null ? (
          <WorldDatePicker
            config={calendarConfig}
            currentTurnNumber={currentTurnNumber}
            disabled={createMutation.isPending}
            label="Memory date"
            onTurnNumberChange={setTurnNumber}
            value={turnNumberToCalendarDate(calendarConfig, turnNumber)}
          />
        ) : null}
      </div>
      <div className="grid gap-1 text-sm">
        <Label htmlFor="memory-text">Memory</Label>
        <Textarea
          id="memory-text"
          aria-label="Memory text"
          className="min-h-16"
          disabled={createMutation.isPending}
          placeholder="What happened…"
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            createMutation.isPending ||
            text.trim() === "" ||
            turnNumber === null
          }
        >
          {createMutation.isPending ? "Saving…" : "Add memory"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- edit form ----------------------------------------------------------

function EditMemoryForm({
  memory,
  onCancel,
  onSuccess,
  queryClient,
  worldId,
}: {
  readonly memory: CitizenMemory;
  readonly onCancel: () => void;
  readonly onSuccess: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));
  const updateMutation = useMutation(
    updateCitizenMemoryMutationOptions({ queryClient }),
  );

  const calendarConfig = calendarQuery.data ?? null;

  const [text, setText] = useState(memory.memoryText);
  const [turnNumber, setTurnNumber] = useState<number | null>(
    memory.occurredOnTurnNumber,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (turnNumber === null) return;

    updateMutation.mutate(
      {
        citizenId: memory.citizenId,
        id: memory.id,
        memoryText: text,
        occurredOnTurnNumber: turnNumber,
        worldId,
      },
      {
        onError: (error) =>
          notifyMutationError(error, "Failed to update memory."),
        onSuccess: () => {
          notifyMutationSuccess("Memory updated.");
          onSuccess();
        },
      },
    );
  }

  if (calendarQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading calendar…</p>;
  }

  if (calendarQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Calendar configuration unavailable.
      </p>
    );
  }

  return (
    <form
      aria-label="Edit memory"
      className="grid gap-3"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="grid gap-1 text-sm">
        <Label htmlFor="edit-memory-date">Date</Label>
        {calendarConfig !== null ? (
          <WorldDatePicker
            config={calendarConfig}
            currentTurnNumber={memory.occurredOnTurnNumber}
            disabled={updateMutation.isPending}
            label="Memory date"
            onTurnNumberChange={setTurnNumber}
            value={turnNumberToCalendarDate(calendarConfig, turnNumber)}
          />
        ) : null}
      </div>
      <div className="grid gap-1 text-sm">
        <Label htmlFor="edit-memory-text">Memory</Label>
        <Textarea
          id="edit-memory-text"
          aria-label="Memory text"
          className="min-h-16"
          disabled={updateMutation.isPending}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={
            updateMutation.isPending ||
            text.trim() === "" ||
            turnNumber === null
          }
        >
          {updateMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={updateMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---- memory row ---------------------------------------------------------

function MemoryRow({
  memory,
  onDelete,
  onEdit,
  worldId,
}: {
  readonly memory: CitizenMemory;
  readonly onDelete: (memory: CitizenMemory) => void;
  readonly onEdit: (memory: CitizenMemory) => void;
  readonly worldId: string;
}): JSX.Element {
  const calendarQuery = useQuery(worldCalendarConfigQueryOptions(worldId));
  const calendarConfig = calendarQuery.data ?? null;

  let dateLabel: string;
  if (calendarConfig !== null) {
    try {
      const resolved = resolveTurnCalendarDate(
        calendarConfig,
        memory.occurredOnTurnNumber,
      );
      const month = calendarConfig.months.find(
        (m) => m.index === resolved.monthIndex,
      );
      dateLabel = `${month?.name ?? ""} ${String(resolved.dayOfMonth)}, Year ${String(resolved.year)}`;
    } catch {
      dateLabel = `Turn ${String(memory.occurredOnTurnNumber)}`;
    }
  } else {
    dateLabel = `Turn ${String(memory.occurredOnTurnNumber)}`;
  }

  const isEvent = memory.source !== "manual" || memory.eventId !== null;

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {dateLabel}
          </span>
          <Badge
            variant={isEvent ? "secondary" : "outline"}
            className="text-xs"
          >
            {memorySourceLabel(memory.source)}
          </Badge>
          {isEvent && memory.eventId !== null ? (
            <a
              href={`/worlds/${worldId}/events/${memory.eventId}`}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              View event
            </a>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Edit memory"
            onClick={() => onEdit(memory)}
          >
            <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Delete memory"
            onClick={() => onDelete(memory)}
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-sm">{memory.memoryText}</p>
    </div>
  );
}

// ---- main section -------------------------------------------------------

export function CitizenMemoriesSection({
  canEdit,
  citizenId,
  currentTurnNumber,
  queryClient,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly citizenId: string;
  readonly currentTurnNumber: number;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const [isAdding, setIsAdding] = useState(false);
  const [editingMemory, setEditingMemory] = useState<CitizenMemory | null>(
    null,
  );
  const [deletingMemory, setDeletingMemory] = useState<CitizenMemory | null>(
    null,
  );

  const memoriesQuery = useQuery(citizenMemoriesQueryOptions(citizenId));
  const deleteMutation = useMutation(
    deleteCitizenMemoryMutationOptions({ queryClient }),
  );

  const memories = memoriesQuery.data ?? [];

  function handleDeleteConfirm(): void {
    if (deletingMemory === null) return;
    deleteMutation.mutate(
      {
        citizenId,
        id: deletingMemory.id,
        worldId,
      },
      {
        onError: (error) =>
          notifyMutationError(error, "Failed to delete memory."),
        onSuccess: () => {
          notifyMutationSuccess("Memory deleted.");
          setDeletingMemory(null);
        },
      },
    );
  }

  return (
    <>
      <Card
        aria-labelledby="citizen-memories-heading"
        className="grid gap-3 p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="citizen-memories-heading" className="text-base font-medium">
            Memories
          </h2>
          {canEdit && !isAdding && editingMemory === null ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
            >
              <Plus aria-hidden="true" />
              Add memory
            </Button>
          ) : null}
          {isAdding || editingMemory !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Close form"
              onClick={() => {
                setIsAdding(false);
                setEditingMemory(null);
              }}
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        {isAdding ? (
          <AddMemoryForm
            citizenId={citizenId}
            currentTurnNumber={currentTurnNumber}
            onCancel={() => setIsAdding(false)}
            onSuccess={() => setIsAdding(false)}
            queryClient={queryClient}
            worldId={worldId}
          />
        ) : null}

        {editingMemory !== null ? (
          <EditMemoryForm
            memory={editingMemory}
            onCancel={() => setEditingMemory(null)}
            onSuccess={() => setEditingMemory(null)}
            queryClient={queryClient}
            worldId={worldId}
          />
        ) : null}

        {!isAdding && editingMemory === null ? (
          memoriesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading memories…</p>
          ) : memoriesQuery.isError ? (
            <p className="text-sm text-destructive">
              Memories could not be loaded.
            </p>
          ) : memories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No memories yet.</p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="flex flex-col">
                {memories.map((memory, index) => (
                  <div key={memory.id}>
                    {index > 0 ? <Separator /> : null}
                    <MemoryRow
                      memory={memory}
                      onDelete={setDeletingMemory}
                      onEdit={setEditingMemory}
                      worldId={worldId}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )
        ) : null}
      </Card>

      <AlertDialog
        open={deletingMemory !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingMemory(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete memory?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the memory. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Keep memory
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete memory"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
