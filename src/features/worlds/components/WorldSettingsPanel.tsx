import { useMutation, type QueryClient } from "@tanstack/react-query";
import { AlertTriangle, Save } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  renameWorldMutationOptions,
  setWorldCurrentTurnNumberMutationOptions,
} from "../mutations/worldSettingsMutations";

type WorldSettingsPanelProps = {
  readonly currentTurnNumber: number;
  readonly queryClient: QueryClient;
  readonly worldId: string;
  readonly worldName: string;
};

export function WorldSettingsPanel({
  currentTurnNumber,
  queryClient,
  worldId,
  worldName,
}: WorldSettingsPanelProps): JSX.Element {
  return (
    <div className="grid gap-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-normal">
            World settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Superadmin-only controls for direct world metadata management.
          </p>
        </div>
      </div>

      <RenameWorldSection
        queryClient={queryClient}
        worldId={worldId}
        worldName={worldName}
      />

      <hr className="border-border" />

      <TurnOverrideSection
        currentTurnNumber={currentTurnNumber}
        queryClient={queryClient}
        worldId={worldId}
      />
    </div>
  );
}

function RenameWorldSection({
  queryClient,
  worldId,
  worldName,
}: {
  readonly queryClient: QueryClient;
  readonly worldId: string;
  readonly worldName: string;
}): JSX.Element {
  const [draftName, setDraftName] = useState(worldName);
  const renameMutation = useMutation(
    renameWorldMutationOptions({ queryClient }),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    renameMutation.mutate(
      { name: draftName, worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "World could not be renamed.");
        },
        onSuccess: () => {
          notifyMutationSuccess("World renamed.");
        },
      },
    );
  }

  const nameError =
    draftName.trim().length === 0
      ? "World name is required."
      : draftName.length > textInputLimits.worldNameMax
        ? "World name is too long."
        : null;

  return (
    <section className="grid gap-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Name</h3>
        <p className="text-sm text-muted-foreground">
          Rename this world. The new name is reflected everywhere worlds are
          listed.
        </p>
      </div>

      <form
        aria-label="Rename world"
        className="grid gap-3"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="grid gap-1.5">
          <label htmlFor="world-name" className="text-sm font-medium">
            World name
          </label>
          <Input
            id="world-name"
            type="text"
            value={draftName}
            maxLength={textInputLimits.worldNameMax}
            aria-invalid={nameError !== null}
            aria-describedby={
              nameError !== null ? "world-name-error" : undefined
            }
            onChange={(e) => setDraftName(e.target.value)}
          />
          {nameError !== null ? (
            <p id="world-name-error" className="text-sm text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>

        <div>
          <Button
            type="submit"
            disabled={renameMutation.isPending || nameError !== null}
          >
            <Save aria-hidden="true" />
            Save name
          </Button>
        </div>
      </form>
    </section>
  );
}

function TurnOverrideSection({
  currentTurnNumber,
  queryClient,
  worldId,
}: {
  readonly currentTurnNumber: number;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const [draftTurn, setDraftTurn] = useState(String(currentTurnNumber));
  const setTurnMutation = useMutation(
    setWorldCurrentTurnNumberMutationOptions({ queryClient }),
  );

  const parsedTurn = Number(draftTurn);
  const turnError =
    draftTurn === ""
      ? "Turn number is required."
      : !Number.isInteger(parsedTurn) || parsedTurn < 0
        ? "Turn number must be a non-negative integer."
        : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setTurnMutation.mutate(
      { turnNumber: parsedTurn, worldId },
      {
        onError: (error) => {
          notifyMutationError(
            error,
            "Current turn number could not be updated.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Current turn number updated.");
        },
      },
    );
  }

  return (
    <section className="grid gap-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Current turn number</h3>
        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-warning-foreground/20 bg-warning px-4 py-3 text-sm text-warning-foreground"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <strong>Direct override</strong> — does not run a turn transition.
            Use only for recovery / testing. Snapshots that exist at turns
            greater than the new value will cause this operation to be rejected.
          </span>
        </div>
      </div>

      <form
        aria-label="Set current turn number"
        className="grid gap-3"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="grid gap-1.5">
          <label htmlFor="current-turn-number" className="text-sm font-medium">
            Current turn number
          </label>
          <Input
            id="current-turn-number"
            type="number"
            min={0}
            step={1}
            value={draftTurn}
            className="max-w-[12rem]"
            aria-invalid={turnError !== null}
            aria-describedby={
              turnError !== null ? "current-turn-number-error" : undefined
            }
            onChange={(e) => setDraftTurn(e.target.value)}
          />
          {turnError !== null ? (
            <p
              id="current-turn-number-error"
              className="text-sm text-destructive"
            >
              {turnError}
            </p>
          ) : null}
        </div>

        <div>
          <Button
            type="submit"
            variant="outline"
            disabled={setTurnMutation.isPending || turnError !== null}
          >
            <Save aria-hidden="true" />
            Save turn number
          </Button>
        </div>
      </form>
    </section>
  );
}
