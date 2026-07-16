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
  History,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type JSX,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";

import { AccessDeniedState } from "@/components/shared/AccessDeniedState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { CardListSkeleton } from "@/components/shared/SkeletonLoaders";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { currentAccessContextQueryOptions } from "@/features/permissions";
import type { AccessContext } from "@/features/permissions";
import { getErrorDescription } from "@/lib/errorUtils";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";

import {
  createWorldMutationOptions,
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
import { readWorldScopePin } from "../utils/worldScopePin";
import { computeDryRunReport } from "../utils/worldTemplateDryRun";

import { WorldCardImage } from "./WorldCardImage";
import {
  DryRunSummary,
  ImportErrorDialog,
  WorldTemplateImportButton,
  type WorldTemplateImportButtonHandle,
} from "./WorldTemplateImportButton";

import type { AccessibleWorld } from "../types/worldTypes";

export type WorldListPageAction = "create" | "import" | undefined;

export function WorldListPage({
  action,
  onClearAction,
}: {
  readonly action?: WorldListPageAction;
  readonly onClearAction?: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const accessContextQuery = useQuery(
    currentAccessContextQueryOptions(queryClient),
  );

  if (accessContextQuery.isPending) {
    return (
      <WorldListFrame>
        <CardListSkeleton rowCount={6} />
      </WorldListFrame>
    );
  }

  if (accessContextQuery.isError) {
    return (
      <WorldListFrame>
        <ErrorState
          title="World access could not be loaded"
          description={getErrorDescription(accessContextQuery.error)}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void accessContextQuery.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      </WorldListFrame>
    );
  }

  return (
    <WorldListContent
      accessContext={accessContextQuery.data}
      action={action}
      onClearAction={onClearAction}
    />
  );
}

function WorldListContent({
  accessContext,
  action,
  onClearAction,
}: {
  readonly accessContext: AccessContext;
  readonly action?: WorldListPageAction;
  readonly onClearAction?: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [showTrash, setShowTrash] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const importButtonRef = useRef<WorldTemplateImportButtonHandle>(null);

  const onClearActionRef = useRef(onClearAction);
  useEffect(() => {
    onClearActionRef.current = onClearAction;
  }, [onClearAction]);

  const worldsQuery = useQuery(accessibleWorldsQueryOptions(accessContext));
  const trashedWorldsQuery = useQuery(trashedWorldsQueryOptions(accessContext));

  useEffect(() => {
    // Wait until the world list (and its actions, including the import
    // button that owns the file input) has actually mounted — otherwise
    // the ref is still null and the action would be cleared without effect.
    if (
      action === undefined ||
      !accessContext.isSuperAdmin ||
      worldsQuery.isPending
    ) {
      return;
    }
    if (action === "create") {
      // eslint-disable-next-line react-hooks/set-state-in-effect, @eslint-react/set-state-in-effect -- deep-link: opens the dialog once the world-list content (and the query it depends on) has mounted
      setShowCreateDialog(true);
    } else {
      importButtonRef.current?.openFilePicker();
    }
    onClearActionRef.current?.();
  }, [action, accessContext.isSuperAdmin, worldsQuery.isPending]);

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

  const effectiveShowTrash = showTrash && accessContext.isSuperAdmin;
  const activeWorlds = worldsQuery.data;
  const trashed = trashedWorldsQuery.data ?? [];

  return (
    <WorldListFrame>
      <div className="grid gap-4">
        <PageHeader
          icon={effectiveShowTrash ? Trash2 : Globe2}
          title={effectiveShowTrash ? "Trash" : "Worlds"}
          actions={
            <WorldListActions
              accessContext={accessContext}
              effectiveShowTrash={effectiveShowTrash}
              importButtonRef={importButtonRef}
              queryClient={queryClient}
              onCreateWorld={() => {
                setShowCreateDialog(true);
              }}
              onToggleTrash={() => {
                setShowTrash(!effectiveShowTrash);
              }}
            />
          }
        />

        {effectiveShowTrash ? (
          <TrashSection
            error={trashedWorldsQuery.error}
            isError={trashedWorldsQuery.isError}
            isPending={trashedWorldsQuery.isPending}
            queryClient={queryClient}
            trashed={trashed}
          />
        ) : (
          <ActiveWorldsSection
            activeWorlds={activeWorlds}
            isSuperAdmin={accessContext.isSuperAdmin}
            queryClient={queryClient}
          />
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

function WorldListActions({
  accessContext,
  effectiveShowTrash,
  importButtonRef,
  queryClient,
  onCreateWorld,
  onToggleTrash,
}: {
  readonly accessContext: AccessContext;
  readonly effectiveShowTrash: boolean;
  readonly importButtonRef: RefObject<WorldTemplateImportButtonHandle | null>;
  readonly queryClient: QueryClient;
  readonly onCreateWorld: () => void;
  readonly onToggleTrash: () => void;
}): JSX.Element {
  if (effectiveShowTrash) {
    return (
      <TrashToggleButton
        showTrash={effectiveShowTrash}
        onToggle={onToggleTrash}
      />
    );
  }

  return (
    <>
      {accessContext.isSuperAdmin ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCreateWorld}
        >
          <Plus aria-hidden="true" />
          Create world
        </Button>
      ) : null}
      {accessContext.isSuperAdmin ? (
        <WorldTemplateImportButton
          ref={importButtonRef}
          queryClient={queryClient}
        />
      ) : null}
      {accessContext.isSuperAdmin ? (
        <TrashToggleButton
          showTrash={effectiveShowTrash}
          onToggle={onToggleTrash}
        />
      ) : null}
    </>
  );
}

function TrashSection({
  isError,
  isPending,
  error,
  queryClient,
  trashed,
}: {
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly queryClient: QueryClient;
  readonly trashed: readonly AccessibleWorld[];
}): JSX.Element {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Permanent deletion happens in{" "}
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link to="/superadmin/worlds">the Superadmin area</Link>
        </Button>
        .
      </p>
      {isPending ? (
        <LoadingState label="Loading trashed worlds…" />
      ) : isError ? (
        <ErrorState
          title="Trashed worlds could not be loaded"
          description={getErrorDescription(error)}
        />
      ) : trashed.length === 0 ? (
        <AccessDeniedState
          title="No worlds in trash"
          description="Worlds you move to trash will appear here."
        />
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
    </>
  );
}

function ActiveWorldsSection({
  activeWorlds,
  isSuperAdmin,
  queryClient,
}: {
  readonly activeWorlds: readonly AccessibleWorld[];
  readonly isSuperAdmin: boolean;
  readonly queryClient: QueryClient;
}): JSX.Element {
  if (activeWorlds.length === 0) {
    return (
      <AccessDeniedState
        title="No accessible worlds"
        description="Your Gubernator account does not currently have access to any worlds."
      />
    );
  }

  return (
    <ul
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Accessible worlds"
    >
      {activeWorlds.map((world) => (
        <WorldListItem
          key={world.id}
          isSuperAdmin={isSuperAdmin}
          queryClient={queryClient}
          world={world}
        />
      ))}
    </ul>
  );
}

function WorldListFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className="flex flex-col gap-5">{children}</div>;
}

function TrashToggleButton({
  showTrash,
  onToggle,
}: {
  readonly showTrash: boolean;
  readonly onToggle: () => void;
}): JSX.Element {
  const label = showTrash ? "Back to worlds" : "Trash";
  const description = showTrash
    ? "Back to active worlds"
    : "Show trashed worlds";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={showTrash}
          onClick={onToggle}
        >
          <Trash2 aria-hidden="true" />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}

type ResumeTarget = {
  readonly nationId: string;
  readonly settlementId: string | null;
};

// #1005's stored scope pin is a free "where was I" bookmark per world
// (localStorage, no request needed) — surface it as a resume shortcut when
// present, otherwise the card just links to the world dashboard as before.
function resumeTargetForWorld(worldId: string): ResumeTarget | null {
  const pin = readWorldScopePin(worldId);
  if (pin.nationId === null) {
    return null;
  }
  return { nationId: pin.nationId, settlementId: pin.settlementId };
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
  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false);
  const trashMutation = useMutation(trashWorldMutationOptions({ queryClient }));
  const resumeTarget = resumeTargetForWorld(world.id);

  async function handleTrash(): Promise<void> {
    try {
      await trashMutation.mutateAsync({ worldId: world.id });
      notifyMutationSuccess("World moved to trash.");
      setTrashConfirmOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to move world to trash.",
      );
    }
  }

  return (
    <li className="group grid gap-3 overflow-hidden rounded-md border border-border bg-card text-card-foreground">
      <Link
        to="/worlds/$worldId"
        params={{ worldId: world.id }}
        className="grid gap-3 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <WorldCardImage world={world} />
        <div className="grid gap-3 px-3 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="truncate text-base font-medium">{world.name}</h2>
              <WorldBadge world={world} />
            </div>
            <ArrowRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <dt className="font-medium text-foreground">Planning turn</dt>
              <dd>{world.planningTurnNumber}</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">In-world date</dt>
              <dd>{world.inWorldDateLabel}</dd>
            </div>
          </dl>
        </div>
      </Link>
      {resumeTarget !== null || isSuperAdmin ? (
        <div className="-mt-3 flex items-center justify-between gap-2 px-3 pb-3">
          {resumeTarget !== null ? (
            <Button asChild variant="outline" size="sm">
              {resumeTarget.settlementId !== null ? (
                <Link
                  to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
                  params={{
                    nationId: resumeTarget.nationId,
                    settlementId: resumeTarget.settlementId,
                    worldId: world.id,
                  }}
                >
                  <History aria-hidden="true" />
                  Resume
                </Link>
              ) : (
                <Link
                  to="/worlds/$worldId/nations/$nationId"
                  params={{
                    nationId: resumeTarget.nationId,
                    worldId: world.id,
                  }}
                >
                  <History aria-hidden="true" />
                  Resume
                </Link>
              )}
            </Button>
          ) : (
            <span />
          )}
          {isSuperAdmin ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Move ${world.name} to trash`}
              title="Move to trash"
              disabled={trashMutation.isPending}
              onClick={() => {
                setTrashConfirmOpen(true);
              }}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      ) : null}
      {trashConfirmOpen ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setTrashConfirmOpen(false);
          }}
          title={`Move ${world.name} to trash?`}
          description={
            <>
              This will move{" "}
              <span className="font-medium text-foreground">{world.name}</span>{" "}
              to the trash and remove it from the world list.
            </>
          }
          confirmLabel="Move to trash"
          isPending={trashMutation.isPending}
          onConfirm={handleTrash}
        />
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
          disabled={restoreMutation.isPending}
          onClick={handleRestore}
        >
          Restore
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline">
            <LockKeyhole className="size-3" aria-hidden="true" />
            Hidden
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Hidden from players; only visible to admins and users with explicit
          access.
        </TooltipContent>
      </Tooltip>
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
        tabIndex={-1}
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
