import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Archive,
  ArrowRight,
  Globe2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type JSX,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";

import {
  createWorldMutationOptions,
  hardDeleteWorldMutationOptions,
  restoreWorldMutationOptions,
  trashWorldMutationOptions,
} from "../mutations/worldAdminMutations";
import { importWorldFromTemplateMutationOptions } from "../mutations/worldTemplateMutations";
import {
  accessibleWorldsQueryOptions,
  trashedWorldsQueryOptions,
} from "../queries/worldQueries";
import { parseWorldTemplate } from "../queries/worldTemplateExportQueries";
import { BUNDLED_SCENARIOS } from "../scenarios/bundledScenarios";
import { computeDryRunReport } from "../utils/worldTemplateDryRun";

import {
  DryRunSummary,
  ImportErrorDialog,
  WorldTemplateImportButton,
} from "./WorldTemplateImportButton";

import type { AccessibleWorld } from "../types/worldTypes";

export function WorldListPage(): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <WorldListFrame>
        <LoadingState label="Loading world access…" />
      </WorldListFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <WorldListFrame>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
        />
      </WorldListFrame>
    );
  }

  return <WorldListContent accessContext={accessContextQuery.data} />;
}

function WorldListContent({
  accessContext,
}: {
  readonly accessContext: AccessContext;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [showTrash, setShowTrash] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const worldsQuery = useQuery(accessibleWorldsQueryOptions(accessContext));
  const trashedWorldsQuery = useQuery(trashedWorldsQueryOptions(accessContext));

  if (accessContext.isAuthenticated && !accessContext.isActiveUser) {
    return (
      <WorldListFrame>
        <AccessDeniedState
          title="Account access unavailable"
          description="Your Gubernator account is not active. Contact an administrator to restore access."
        />
      </WorldListFrame>
    );
  }

  if (worldsQuery.isPending) {
    return (
      <WorldListFrame>
        <LoadingState label="Loading worlds…" />
      </WorldListFrame>
    );
  }

  if (worldsQuery.isError) {
    return (
      <WorldListFrame>
        <ErrorState
          title="Worlds could not be loaded"
          description={getErrorDescription(worldsQuery.error)}
        />
      </WorldListFrame>
    );
  }

  if (showTrash && accessContext.isSuperAdmin) {
    const trashed = trashedWorldsQuery.data ?? [];
    return (
      <WorldListFrame>
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-normal">Trash</h1>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Hide trash"
              aria-pressed
              title="Hide trash"
              onClick={() => {
                setShowTrash(false);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          {trashedWorldsQuery.isPending ? (
            <LoadingState label="Loading trashed worlds…" />
          ) : trashedWorldsQuery.isError ? (
            <ErrorState
              title="Trashed worlds could not be loaded"
              description={getErrorDescription(trashedWorldsQuery.error)}
            />
          ) : trashed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No worlds in trash.</p>
          ) : (
            <ul className="grid gap-2" aria-label="Trashed worlds">
              {trashed.map((world) => (
                <TrashedWorldRow
                  key={world.id}
                  queryClient={queryClient}
                  world={world}
                />
              ))}
            </ul>
          )}
        </div>
      </WorldListFrame>
    );
  }

  const activeWorlds = worldsQuery.data;

  return (
    <WorldListFrame>
      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-normal">Worlds</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Choose an accessible simulation world to continue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {accessContext.isSuperAdmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateDialog(true);
                }}
              >
                <Plus aria-hidden="true" />
                Create world
              </Button>
            ) : null}
            {accessContext.isSuperAdmin ? (
              <WorldTemplateImportButton queryClient={queryClient} />
            ) : null}
            {accessContext.isSuperAdmin ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Show trash"
                aria-pressed={false}
                title="Show trash"
                onClick={() => {
                  setShowTrash(true);
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>

        {activeWorlds.length === 0 ? (
          <AccessDeniedState
            title="No accessible worlds"
            description="Your Gubernator account does not currently have access to any worlds."
          />
        ) : (
          <ul className="grid gap-3" aria-label="Accessible worlds">
            {activeWorlds.map((world) => (
              <WorldListItem
                key={world.id}
                isSuperAdmin={accessContext.isSuperAdmin}
                queryClient={queryClient}
                world={world}
              />
            ))}
          </ul>
        )}
      </div>

      {showCreateDialog ? (
        <CreateWorldDialog
          queryClient={queryClient}
          onClose={() => {
            setShowCreateDialog(false);
          }}
        />
      ) : null}
    </WorldListFrame>
  );
}

function WorldListFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 py-6">{children}</div>
  );
}

function WorldListItem({
  isSuperAdmin,
  queryClient,
  world,
}: {
  readonly isSuperAdmin: boolean;
  readonly queryClient: QueryClient;
  readonly world: AccessibleWorld;
}): JSX.Element {
  const trashMutation = useMutation(trashWorldMutationOptions({ queryClient }));

  function handleTrash(): void {
    trashMutation.mutate(
      { worldId: world.id },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to move world to trash.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("World moved to trash.");
        },
      },
    );
  }

  return (
    <li className="group grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center rounded-md border border-border bg-card text-card-foreground">
      <Link
        to="/worlds/$worldId"
        params={{ worldId: world.id }}
        className="grid gap-4 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[1fr_auto] sm:items-center"
      >
        <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-medium">{world.name}</h2>
            <WorldBadge world={world} />
          </div>
          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
            <div>
              <dt className="font-medium text-foreground">Planning turn</dt>
              <dd>{world.planningTurnNumber}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">In-world date</dt>
              <dd>{world.inWorldDateLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Status</dt>
              <dd className="capitalize">{world.status}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Visibility</dt>
              <dd className="capitalize">{world.visibility}</dd>
            </div>
          </dl>
        </div>
        <ArrowRight
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
      {isSuperAdmin ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Move ${world.name} to trash`}
          title="Move to trash"
          disabled={trashMutation.isPending}
          onClick={handleTrash}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}

function TrashedWorldRow({
  queryClient,
  world,
}: {
  readonly queryClient: QueryClient;
  readonly world: AccessibleWorld;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreWorldMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteWorldMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { worldId: world.id },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Failed to restore world.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("World restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { worldId: world.id },
      {
        onError: (error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to permanently delete world.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("World permanently deleted.");
        },
      },
    );
  }

  return (
    <li className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
      <div className="grid gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{world.name}</span>
          <Badge variant="outline">trashed</Badge>
        </div>
        <span className="text-xs text-muted-foreground capitalize">
          {world.status} · {world.visibility}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleRestore}
        >
          Restore
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleHardDelete}
        >
          Delete permanently
        </Button>
      </div>
    </li>
  );
}

function WorldBadge({
  world,
}: {
  readonly world: AccessibleWorld;
}): JSX.Element {
  if (world.isArchived) {
    return (
      <Badge variant="outline">
        <Archive className="size-3" aria-hidden="true" />
        Archived
      </Badge>
    );
  }

  if (world.isHidden) {
    return (
      <Badge variant="outline">
        <LockKeyhole className="size-3" aria-hidden="true" />
        Hidden
      </Badge>
    );
  }

  if (world.canManage) {
    return (
      <Badge variant="outline">
        <ShieldCheck className="size-3" aria-hidden="true" />
        Manage
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      <Globe2 className="size-3" aria-hidden="true" />
      Public
    </Badge>
  );
}

type CreateWorldFieldErrors = {
  readonly name?: string;
};

function CreateWorldDialog({
  onClose,
  queryClient,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const createMutation = useMutation(
    createWorldMutationOptions({ queryClient }),
  );
  const importMutation = useMutation(
    importWorldFromTemplateMutationOptions({ queryClient }),
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [fieldErrors, setFieldErrors] = useState<CreateWorldFieldErrors>({});
  const [templateChoice, setTemplateChoice] = useState<string>("none");
  const [uploadedTemplate, setUploadedTemplate] =
    useState<WorldTemplate | null>(null);
  const [uploadParseError, setUploadParseError] = useState<string | null>(null);

  const isPending = createMutation.isPending || importMutation.isPending;

  const effectiveTemplate = useMemo<WorldTemplate | null>(() => {
    if (templateChoice === "none") return null;
    if (templateChoice === "uploaded") return uploadedTemplate;
    const scenarioId = templateChoice.replace("bundled:", "");
    return BUNDLED_SCENARIOS.find((s) => s.id === scenarioId)?.template ?? null;
  }, [templateChoice, uploadedTemplate]);

  const dryRunReport = useMemo(
    () =>
      effectiveTemplate !== null
        ? computeDryRunReport(effectiveTemplate)
        : null,
    [effectiveTemplate],
  );

  const effectiveTemplateName = useMemo<string | null>(() => {
    if (templateChoice === "uploaded")
      return uploadedTemplate?.meta.name ?? null;
    if (templateChoice !== "none") {
      const scenarioId = templateChoice.replace("bundled:", "");
      return BUNDLED_SCENARIOS.find((s) => s.id === scenarioId)?.name ?? null;
    }
    return null;
  }, [templateChoice, uploadedTemplate]);

  function handleTemplateChoiceChange(
    e: React.ChangeEvent<HTMLSelectElement>,
  ): void {
    const value = e.currentTarget.value;
    setTemplateChoice(value);
    setUploadedTemplate(null);
    setUploadParseError(null);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file === undefined) return;
    setUploadParseError(null);
    setUploadedTemplate(null);
    const reader = new FileReader();
    reader.onload = (e): void => {
      const raw = typeof e.target?.result === "string" ? e.target.result : "";
      const result = parseWorldTemplate(raw);
      if (!result.ok) {
        setUploadParseError(result.error);
      } else {
        setUploadedTemplate(result.data);
        setName(result.data.meta.name);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldErrors({});

    if (name.trim().length === 0) {
      setFieldErrors({ name: "World name is required." });
      return;
    }

    if (effectiveTemplate === null) {
      createMutation.mutate(
        { name, visibility },
        {
          onError: (error) => {
            toast.error(
              error instanceof Error
                ? error.message
                : "Failed to create world.",
            );
          },
          onSuccess: () => {
            notifyMutationSuccess("World created.");
            onClose();
          },
        },
      );
    } else {
      if (dryRunReport !== null && dryRunReport.danglingRefs.length > 0) {
        toast.error("Template has cross-reference errors", {
          description: "Resolve the errors in the template before importing.",
        });
        return;
      }
      importMutation.mutate(
        { name, visibility, template: effectiveTemplate },
        {
          onError: (error) => {
            toast.error("Import failed", {
              description:
                error instanceof Error
                  ? error.message
                  : "Could not import template.",
            });
          },
          onSuccess: () => {
            notifyMutationSuccess("World created from template.");
            onClose();
          },
        },
      );
    }
  }

  const submitDisabled =
    isPending || (templateChoice === "uploaded" && uploadedTemplate === null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        aria-hidden="true"
        className="sr-only"
        onChange={handleFileChange}
      />

      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-sm">
          <form className="contents" noValidate onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create world</DialogTitle>
              <DialogDescription>
                Create a world and choose its initial mode.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              {/* Template select */}
              <Label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Starting template</span>
                <NativeSelect
                  className="w-full"
                  disabled={isPending}
                  value={templateChoice}
                  onChange={handleTemplateChoiceChange}
                >
                  <option value="none">None (blank world)</option>
                  <optgroup label="Bundled scenarios">
                    {BUNDLED_SCENARIOS.map((s) => (
                      <option key={s.id} value={`bundled:${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  <option value="uploaded">Upload template…</option>
                </NativeSelect>
              </Label>

              {/* Upload button (visible when "uploaded" chosen) */}
              {templateChoice === "uploaded" ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                  >
                    {uploadedTemplate !== null
                      ? "Replace file…"
                      : "Choose file…"}
                  </Button>
                  {uploadedTemplate !== null ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {uploadedTemplate.meta.name}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No file chosen
                    </span>
                  )}
                </div>
              ) : null}

              {/* Dry-run summary (when a template is selected) */}
              {effectiveTemplate !== null &&
              dryRunReport !== null &&
              effectiveTemplateName !== null ? (
                <DryRunSummary
                  report={dryRunReport}
                  templateName={effectiveTemplateName}
                />
              ) : null}

              {/* Name */}
              <Label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Name</span>
                <Input
                  aria-invalid={fieldErrors.name !== undefined}
                  aria-label="World name"
                  autoFocus
                  disabled={isPending}
                  maxLength={textInputLimits.worldNameMax}
                  value={name}
                  onChange={(e) => {
                    setName(e.currentTarget.value);
                  }}
                />
                {fieldErrors.name !== undefined ? (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
                ) : null}
              </Label>

              {/* Visibility */}
              <Label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Visibility</span>
                <NativeSelect
                  className="w-full"
                  disabled={isPending}
                  value={visibility}
                  onChange={(e) => {
                    setVisibility(
                      e.currentTarget.value as "public" | "private",
                    );
                  }}
                >
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </NativeSelect>
              </Label>
            </div>
            <DialogFooter>
              <Button
                disabled={isPending}
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button disabled={submitDisabled} type="submit">
                {isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {uploadParseError !== null ? (
        <ImportErrorDialog
          error={uploadParseError}
          onClose={() => {
            setUploadParseError(null);
            setTemplateChoice("none");
          }}
        />
      ) : null}
    </>
  );
}
