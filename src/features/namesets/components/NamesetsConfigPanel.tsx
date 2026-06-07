import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { AlertTriangle, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PoolEditor } from "@/components/shared/PoolEditor";
import { sanitizePoolEntries } from "@/components/shared/PoolEditorUtils";
import { Badge } from "@/components/ui/badge";
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
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";
import {
  NAME_CONVENTIONS,
  type NameConvention,
  type WorldNamingConfig,
} from "@/lib/worldNamingConfigSchemas";

import {
  createNamesetMutationOptions,
  hardDeleteNamesetMutationOptions,
  restoreNamesetMutationOptions,
  setDefaultNamesetMutationOptions,
  softDeleteNamesetMutationOptions,
  updateNamesetMutationOptions,
} from "../mutations/namesetsMutations";
import { namesetsByWorldQueryOptions } from "../queries/namesetsQueries";

import type { Nameset } from "../types/namesetTypes";

type NamesetsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function NamesetsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: NamesetsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const namesetsQuery = useQuery(namesetsByWorldQueryOptions(worldId));

  if (namesetsQuery.isPending) {
    return <LoadingState label="Loading namesets…" />;
  }

  if (namesetsQuery.isError) {
    return (
      <ErrorState
        title="Namesets could not be loaded"
        description={getErrorDescription(namesetsQuery.error)}
      />
    );
  }

  return (
    <NamesetsConfigPanelContent
      allNamesets={namesetsQuery.data}
      canAdmin={canAdmin}
      isArchived={isArchived}
      queryClient={queryClient}
      worldId={worldId}
    />
  );
}

function NamesetsConfigPanelContent({
  allNamesets,
  canAdmin,
  isArchived,
  queryClient,
  worldId,
}: {
  readonly allNamesets: readonly Nameset[];
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const createMutation = useMutation(
    createNamesetMutationOptions({ queryClient }),
  );
  const [showForm, setShowForm] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [editingNamesetId, setEditingNamesetId] = useState<string | null>(null);
  const canEdit = canAdmin && !isArchived;

  const namesets = showTrash
    ? allNamesets.filter((ns) => ns.isTrashed)
    : allNamesets.filter((ns) => !ns.isTrashed);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2
          id="world-namesets-title"
          className="text-lg font-semibold tracking-normal"
        >
          Namesets
        </h2>
        <div className="flex items-center gap-2">
          {canEdit && !showForm && !showTrash ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add nameset
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant={showTrash ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={showTrash ? "Hide trash" : "Show trash"}
              aria-pressed={showTrash}
              title={showTrash ? "Hide trash" : "Show trash"}
              onClick={() => {
                setShowTrash((v) => !v);
                setEditingNamesetId(null);
                setShowForm(false);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {canEdit
          ? "Namesets bundle naming pools and a convention. Nations and settlements can override the world default."
          : "Namesets define the naming pools and convention used for random NPC creation."}
      </p>

      {namesets.length > 0 ? (
        <NamesetList
          canEdit={canEdit}
          editingNamesetId={editingNamesetId}
          namesets={namesets}
          queryClient={queryClient}
          showTrash={showTrash}
          worldId={worldId}
          onEditingChange={setEditingNamesetId}
        />
      ) : (
        <EmptyState
          title={showTrash ? "No namesets in trash" : "No namesets yet"}
          description={
            showTrash ? undefined : "Add the first nameset for this world."
          }
        />
      )}

      {canEdit && showForm && !showTrash ? (
        <CreateNamesetDialog
          isPending={createMutation.isPending}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(name, configJson) => {
            createMutation.mutate(
              { worldId, name, configJson },
              {
                onError: (error) => {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to create nameset.",
                  );
                },
                onSuccess: () => {
                  notifyMutationSuccess("Nameset created.");
                  setShowForm(false);
                },
              },
            );
          }}
        />
      ) : null}
    </div>
  );
}

function NamesetList({
  canEdit,
  editingNamesetId,
  namesets,
  queryClient,
  showTrash,
  worldId,
  onEditingChange,
}: {
  readonly canEdit: boolean;
  readonly editingNamesetId: string | null;
  readonly namesets: readonly Nameset[];
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
  readonly onEditingChange: (id: string | null) => void;
}): JSX.Element {
  return (
    <ul aria-label="Namesets" className="grid gap-2">
      {namesets.map((nameset) => {
        if (showTrash) {
          return (
            <TrashedNamesetRow
              key={nameset.id}
              nameset={nameset}
              queryClient={queryClient}
              worldId={worldId}
            />
          );
        }
        return editingNamesetId === nameset.id ? (
          <li key={nameset.id}>
            <EditNamesetForm
              nameset={nameset}
              queryClient={queryClient}
              worldId={worldId}
              onClose={() => {
                onEditingChange(null);
              }}
            />
          </li>
        ) : (
          <NamesetRow
            key={nameset.id}
            canEdit={canEdit}
            nameset={nameset}
            queryClient={queryClient}
            worldId={worldId}
            onEdit={() => {
              onEditingChange(nameset.id);
            }}
          />
        );
      })}
    </ul>
  );
}

function NamesetRow({
  canEdit,
  nameset,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly nameset: Nameset;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const softDeleteMutation = useMutation(
    softDeleteNamesetMutationOptions({ queryClient }),
  );
  const setDefaultMutation = useMutation(
    setDefaultNamesetMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to move nameset to trash.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset moved to trash.");
        },
      },
    );
  }

  function handleSetDefault(): void {
    setDefaultMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to set default nameset.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Default nameset updated.");
        },
      },
    );
  }

  const isPending =
    softDeleteMutation.isPending || setDefaultMutation.isPending;

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{nameset.name}</span>
          {nameset.isDefault ? (
            <Badge variant="secondary">default</Badge>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {nameset.configJson.convention}
          {" · "}
          {nameset.configJson.male_given_names.length +
            nameset.configJson.female_given_names.length}{" "}
          given names
        </span>
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2">
          {!nameset.isDefault ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Set ${nameset.name} as world default`}
              title="Set as world default"
              disabled={isPending}
              onClick={handleSetDefault}
            >
              <Star aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onEdit}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              nameset.isDefault
                ? `${nameset.name} is the world default and cannot be trashed`
                : `Move ${nameset.name} to trash`
            }
            title={
              nameset.isDefault
                ? "Set another nameset as default first"
                : "Move to trash"
            }
            disabled={nameset.isDefault || isPending}
            onClick={nameset.isDefault ? undefined : handleTrash}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function TrashedNamesetRow({
  nameset,
  queryClient,
  worldId,
}: {
  readonly nameset: Nameset;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreNamesetMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteNamesetMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to restore nameset.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to delete nameset.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <span className="text-sm font-medium">{nameset.name}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleRestore}
        >
          <RotateCcw aria-hidden="true" />
          Restore
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleHardDelete}
        >
          <Trash2 aria-hidden="true" />
          Delete permanently
        </Button>
      </div>
    </li>
  );
}

function EditNamesetForm({
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
      toast.error(
        error instanceof Error ? error.message : "Failed to save nameset.",
      );
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

      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={nameError !== undefined}
          disabled={isPending}
          maxLength={64}
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
          }}
        />
        {nameError !== undefined ? (
          <p className="text-xs text-destructive">{nameError}</p>
        ) : null}
      </label>

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

function CreateNamesetDialog({
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
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={nameError !== undefined}
                aria-label="Nameset name"
                disabled={isPending}
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
            </label>
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

function NamingConfigFields({
  config,
  onChange,
}: {
  readonly config: WorldNamingConfig;
  readonly onChange: (config: WorldNamingConfig) => void;
}): JSX.Element {
  const hasEmptyPool =
    config.male_given_names.length === 0 ||
    config.female_given_names.length === 0;
  const showEmptyPoolWarning = config.convention !== "manual" && hasEmptyPool;

  return (
    <div className="grid gap-4">
      {showEmptyPoolWarning ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-warning-foreground/20 bg-warning px-4 py-3 text-sm text-warning-foreground"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            One or more name pools are empty. Random NPC names may be blank
            unless <strong>manual only</strong> is selected.
          </span>
        </div>
      ) : null}

      <PoolEditor
        label="Male given name pool"
        entries={config.male_given_names}
        onChange={(entries) =>
          onChange({ ...config, male_given_names: entries })
        }
      />

      <PoolEditor
        label="Female given name pool"
        entries={config.female_given_names}
        onChange={(entries) =>
          onChange({ ...config, female_given_names: entries })
        }
      />

      <PoolEditor
        label="Surname pool"
        entries={config.surnames}
        onChange={(entries) => onChange({ ...config, surnames: entries })}
      />

      <fieldset className="grid gap-2">
        <legend className="text-base font-semibold">Naming convention</legend>
        <div className="grid gap-1.5">
          {NAME_CONVENTIONS.map((convention) => (
            <label key={convention} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`convention-${convention}`}
                className="h-4 w-4 accent-primary"
                value={convention}
                checked={config.convention === convention}
                onChange={() => onChange({ ...config, convention })}
              />
              <ConventionLabel convention={convention} />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function ConventionLabel({
  convention,
}: {
  readonly convention: NameConvention;
}): JSX.Element {
  switch (convention) {
    case "random":
      return <span>Random — pick any name from the pool</span>;
    case "patronymic":
      return <span>Patronymic — family name derived from father</span>;
    case "matronymic":
      return <span>Matronymic — family name derived from mother</span>;
    case "inherited family name":
      return <span>Inherited family name — surname passed from parents</span>;
    case "manual":
      return (
        <span>
          Manual only — names must be set manually; no automatic generation
        </span>
      );
  }
}
