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
import {
  type WorldGeneratedNamingConfig,
  type WorldListNamingConfig,
  type WorldNamingConfig,
} from "@/lib/worldNamingConfigSchemas";

import { updateNamesetMutationOptions } from "../../mutations/namesetsMutations";

import { NamesetLibraryPicker } from "./NamesetLibraryPicker";
import { NamingConfigFields } from "./NamingConfigFields";
import { formatMutationError } from "./utils/FormatMutationError";

import type { Nameset } from "../../types/namesetTypes";

const EMPTY_LIST_CONFIG: WorldListNamingConfig = {
  type: "list",
  convention: "pool",
  female_given_names: [],
  male_given_names: [],
  surnames: [],
};

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
  const isGenerated = nameset.configJson.type === "generated";
  const [config, setConfig] = useState<WorldListNamingConfig>(
    nameset.configJson.type === "list" ? nameset.configJson : EMPTY_LIST_CONFIG,
  );
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

    let configJson: WorldNamingConfig = nameset.configJson;
    if (!isGenerated) {
      const sanitized: WorldListNamingConfig = {
        ...config,
        female_given_names: sanitizePoolEntries(config.female_given_names),
        male_given_names: sanitizePoolEntries(config.male_given_names),
        surnames: sanitizePoolEntries(config.surnames),
      };
      setConfig(sanitized);
      configJson = sanitized;
    }

    try {
      await updateMutation.mutateAsync({
        namesetId: nameset.id,
        worldId,
        name: trimmed,
        configJson,
      });
      notifyMutationSuccess("Nameset saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, formatMutationError(error));
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form
          aria-label="Edit nameset"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit nameset</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
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

            {isGenerated ? (
              <p className="text-sm text-muted-foreground">
                This nameset generates names from patterns and can&apos;t be
                edited here yet. Only the name can be changed.
              </p>
            ) : (
              <NamingConfigFields config={config} onChange={setConfig} />
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type NamesetKind = "generated" | "list";
type GeneratedSource = "library" | "scratch";

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
  const [nameError, setNameError] = useState<string | undefined>();
  const [kind, setKind] = useState<NamesetKind>("list");
  const [listConfig, setListConfig] =
    useState<WorldListNamingConfig>(EMPTY_LIST_CONFIG);
  const [generatedSource, setGeneratedSource] =
    useState<GeneratedSource>("library");
  const [libraryEntryId, setLibraryEntryId] = useState<string | null>(null);
  const [generatedConfig, setGeneratedConfig] =
    useState<WorldGeneratedNamingConfig | null>(null);

  const canSubmit =
    kind === "list" ||
    (generatedSource === "library" && generatedConfig !== null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setNameError("Name is required.");
      return;
    }
    if (kind === "list") {
      const sanitized: WorldListNamingConfig = {
        ...listConfig,
        female_given_names: sanitizePoolEntries(listConfig.female_given_names),
        male_given_names: sanitizePoolEntries(listConfig.male_given_names),
        surnames: sanitizePoolEntries(listConfig.surnames),
      };
      onSubmit(trimmed, sanitized);
      return;
    }
    if (generatedConfig === null) return;
    onSubmit(trimmed, generatedConfig);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create nameset</DialogTitle>
            <DialogDescription>
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

            <fieldset className="grid gap-2">
              <legend className="text-base font-semibold">Type</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <NamesetKindOption
                  checked={kind === "list"}
                  description="Enter male, female, and surname pools manually."
                  disabled={isPending}
                  label="List"
                  value="list"
                  onSelect={() => {
                    setKind("list");
                  }}
                />
                <NamesetKindOption
                  checked={kind === "generated"}
                  description="Build names from a pattern-based generator."
                  disabled={isPending}
                  label="Generated"
                  value="generated"
                  onSelect={() => {
                    setKind("generated");
                  }}
                />
              </div>
            </fieldset>

            {kind === "list" ? (
              <NamingConfigFields
                config={listConfig}
                onChange={setListConfig}
              />
            ) : (
              <div className="grid gap-3">
                <fieldset className="grid gap-2">
                  <legend className="text-sm font-medium">Source</legend>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <NamesetKindOption
                      checked={generatedSource === "library"}
                      description="Pick a ready-made generator from the library."
                      disabled={isPending}
                      label="From library"
                      value="library"
                      onSelect={() => {
                        setGeneratedSource("library");
                      }}
                    />
                    <NamesetKindOption
                      checked={generatedSource === "scratch"}
                      description="Coming soon."
                      disabled
                      label="From scratch"
                      value="scratch"
                      onSelect={() => {
                        setGeneratedSource("scratch");
                      }}
                    />
                  </div>
                </fieldset>

                {generatedSource === "library" ? (
                  <NamesetLibraryPicker
                    selectedId={libraryEntryId}
                    onSelect={(id, displayName, config) => {
                      setLibraryEntryId(id);
                      setGeneratedConfig(config);
                      if (name.trim().length === 0) {
                        setName(displayName);
                      }
                    }}
                  />
                ) : null}
              </div>
            )}
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
            <Button disabled={isPending || !canSubmit} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NamesetKindOption({
  checked,
  description,
  disabled = false,
  label,
  value,
  onSelect,
}: {
  readonly checked: boolean;
  readonly description: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly value: string;
  readonly onSelect: () => void;
}): JSX.Element {
  const id = `nameset-option-${value}`;
  return (
    <Label
      className={
        "flex items-start gap-2 rounded-md border p-3 text-sm " +
        (disabled ? "opacity-50" : "cursor-pointer")
      }
      htmlFor={id}
    >
      <input
        checked={checked}
        className="mt-0.5 h-4 w-4 accent-primary"
        disabled={disabled}
        id={id}
        type="radio"
        value={value}
        onChange={onSelect}
      />
      <span className="grid gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </Label>
  );
}
