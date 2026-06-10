import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { sanitizePoolEntries } from "@/components/shared/PoolEditorUtils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyMutationSuccess } from "@/lib/notify";
import { type WorldNamingConfig } from "@/lib/worldNamingConfigSchemas";

import { updateNamesetMutationOptions } from "../../mutations/namesetsMutations";

import { NamingConfigFields } from "./NamingConfigFields";
import { formatMutationError } from "./utils/FormatMutationError";

import type { Nameset } from "../../types/namesetTypes";

export function EditNamesetForm({
  nameset,
  queryClient,
  worldId,
  onClose,
}: {
  readonly nameset: Nameset;
  readonly queryClient: QueryClient;
  readonly worldId: string;
  readonly onClose: () => void;
}): JSX.Element {
  const updateMutation = useMutation(
    updateNamesetMutationOptions({ queryClient }),
  );
  const [name, setName] = useState(nameset.name);
  const [config, setConfig] = useState<WorldNamingConfig>(nameset.configJson);
  const [nameError, setNameError] = useState<string | undefined>();
  const isPending = updateMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setNameError(undefined);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setNameError("Name is required.");
      return;
    }

    const sanitized: WorldNamingConfig = {
      ...config,
      female_given_names: sanitizePoolEntries(config.female_given_names),
      male_given_names: sanitizePoolEntries(config.male_given_names),
      surnames: sanitizePoolEntries(config.surnames),
    };
    setConfig(sanitized);

    try {
      await updateMutation.mutateAsync({
        namesetId: nameset.id,
        worldId,
        name: trimmed,
        configJson: sanitized,
      });
      notifyMutationSuccess("Nameset saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, formatMutationError(error));
    }
  }

  return (
    <form
      aria-label="Edit nameset"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit nameset</h3>

      <Label className="grid gap-1 text-sm" htmlFor="edit-nameset-name">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={nameError !== undefined}
          disabled={isPending}
          id="edit-nameset-name"
          maxLength={64}
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
          }}
        />
        {nameError !== undefined ? (
          <p className="text-xs text-destructive">{nameError}</p>
        ) : null}
      </Label>

      <NamingConfigFields config={config} onChange={setConfig} />

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CreateNamesetDialog({
  isPending,
  onCancel,
  onSubmit,
}: {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (name: string, configJson: WorldNamingConfig) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [config, setConfig] = useState<WorldNamingConfig>({
    convention: "random",
    female_given_names: [],
    male_given_names: [],
    surnames: [],
  });
  const [nameError, setNameError] = useState<string | undefined>();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setNameError("Name is required.");
      return;
    }
    const sanitized: WorldNamingConfig = {
      ...config,
      female_given_names: sanitizePoolEntries(config.female_given_names),
      male_given_names: sanitizePoolEntries(config.male_given_names),
      surnames: sanitizePoolEntries(config.surnames),
    };
    onSubmit(trimmed, sanitized);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create nameset</DialogTitle>
            <DialogDescription className="sr-only">
              Define naming pools and conventions for this nameset.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Label className="grid gap-1 text-sm" htmlFor="create-nameset-name">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={nameError !== undefined}
                aria-label="Nameset name"
                disabled={isPending}
                id="create-nameset-name"
                maxLength={64}
                placeholder="e.g. Norse, Latin, Default"
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {nameError !== undefined ? (
                <p className="text-xs text-destructive">{nameError}</p>
              ) : null}
            </Label>
            <NamingConfigFields config={config} onChange={setConfig} />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
