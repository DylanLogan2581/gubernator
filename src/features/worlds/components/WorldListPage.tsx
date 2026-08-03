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
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  User,
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
import {
  notifyError,
  notifyMutationError,
  notifyMutationSuccess,
  resolveMutationErrorMessage,
} from "@/lib/notify";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";

import {
  createWorldMutationOptions,
  restoreWorldMutationOptions,
  trashWorldMutationOptions,
} from "../mutations/worldAdminMutations";
import { importWorldFromTemplateMutationOptions } from "../mutations/worldTemplateMutations";
import { worldListStatsQueryOptions } from "../queries/worldListStatsQueries";
import {
  accessibleWorldsQueryOptions,
  trashedWorldsQueryOptions,
} from "../queries/worldQueries";
import { parseWorldTemplate } from "../queries/worldTemplateExportQueries";
import { BUNDLED_SCENARIOS } from "../scenarios/bundledScenarios";
import {
  formatLastTurnLabel,
  formatPlayerCharacterCount,
} from "../utils/worldDisplay";
import { computeDryRunReport } from "../utils/worldTemplateDryRun";

import { WorldAvatar } from "./WorldAvatar";
import { WorldCardImage } from "./WorldCardImage";
import {
  DryRunSummary,
  ImportErrorDialog,
  WorldTemplateImportButton,
  type WorldTemplateImportButtonHandle,
} from "./WorldTemplateImportButton";

import type { AccessibleWorld, WorldListStats } from "../types/worldTypes";

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
  const worldStatsQuery = useQuery(worldListStatsQueryOptions());

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
  const worldStats = worldStatsQuery.data;

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
            worldStats={worldStats}
          />
        ) : (
          <ActiveWorldsSection
            activeWorlds={activeWorlds}
            isSuperAdmin={accessContext.isSuperAdmin}
            queryClient={queryClient}
            worldStats={worldStats}
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
  worldStats,
}: {
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly queryClient: QueryClient;
  readonly trashed: readonly AccessibleWorld[];
  readonly worldStats: ReadonlyMap<string, WorldListStats> | undefined;
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
              stats={worldStats?.get(world.id)}
              world={world}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function activeWorldsLayoutClassName(count: number): string {
  if (count === 1) {
    // Single world: large full-width showcase card.
    return "grid gap-3";
  }
  if (count <= 4) {
    // 2-4 worlds: prominent two-column layout with larger cards.
    return "grid gap-3 sm:grid-cols-2";
  }
  // 5+ worlds: original dense grid.
  return "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";
}

function ActiveWorldsSection({
  activeWorlds,
  isSuperAdmin,
  queryClient,
  worldStats,
}: {
  readonly activeWorlds: readonly AccessibleWorld[];
  readonly isSuperAdmin: boolean;
  readonly queryClient: QueryClient;
  readonly worldStats: ReadonlyMap<string, WorldListStats> | undefined;
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
      className={activeWorldsLayoutClassName(activeWorlds.length)}
      aria-label="Accessible worlds"
    >
      {activeWorlds.map((world) => (
        <WorldListItem
          key={world.id}
          isSuperAdmin={isSuperAdmin}
          queryClient={queryClient}
          stats={worldStats?.get(world.id)}
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

function WorldListItem({
  isSuperAdmin,
  queryClient,
  stats,
  world,
}: {
  readonly isSuperAdmin: boolean;
  readonly queryClient: QueryClient;
  readonly stats: WorldListStats | undefined;
  readonly world: AccessibleWorld;
}): JSX.Element {
  const [trashConfirmOpen, setTrashConfirmOpen] = useState(false);
  const trashMutation = useMutation(trashWorldMutationOptions({ queryClient }));

  async function handleTrash(): Promise<void> {
    try {
      await trashMutation.mutateAsync({ worldId: world.id });
      notifyMutationSuccess("World moved to trash.");
      setTrashConfirmOpen(false);
    } catch (error) {
      notifyMutationError(error, "Failed to move world to trash.");
    }
  }

  return (
    <li className="group grid gap-3 overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
      <Link
        to="/worlds/$worldId"
        params={{ worldId: world.id }}
        className="grid gap-3 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <WorldCardBody stats={stats} world={world} />
      </Link>
      {isSuperAdmin ? (
        <div className="-mt-3 flex items-center justify-end gap-2 px-3 pb-3">
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
  stats,
  world,
}: {
  readonly queryClient: QueryClient;
  readonly stats: WorldListStats | undefined;
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
          notifyMutationError(error, "Failed to restore world.");
        },
        onSuccess: () => {
          notifyMutationSuccess("World restored.");
        },
      },
    );
  }

  return (
    <li className="grid gap-3 overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10">
      <WorldCardBody stats={stats} world={world} trashed />
      <div className="-mt-3 flex items-center justify-end gap-2 px-3 pb-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Restore ${world.name}`}
          title="Restore"
          disabled={restoreMutation.isPending}
          onClick={handleRestore}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

// Shared presentational body for a world card in the /worlds list. The trashed
// variant grays the hero, overlays a trash glyph, mutes the arrow, and swaps
// the access badge for a "trashed" marker (#1359).
function WorldCardBody({
  stats,
  world,
  trashed = false,
}: {
  readonly stats: WorldListStats | undefined;
  readonly world: AccessibleWorld;
  readonly trashed?: boolean;
}): JSX.Element {
  return (
    <div className="grid gap-3">
      <div className="relative">
        <div className={trashed ? "opacity-60 grayscale" : undefined}>
          <WorldCardImage world={world} />
        </div>
        {trashed ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Trash2
              className="size-8 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 px-3 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <WorldAvatar
            className="shrink-0"
            thumbnailPath={world.thumbnailPath}
            worldId={world.id}
            worldName={world.name}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-base font-medium">{world.name}</h2>
            {trashed ? (
              <Badge variant="outline">trashed</Badge>
            ) : (
              <WorldBadge world={world} />
            )}
          </div>
          <ArrowRight
            className={
              trashed
                ? "size-4 shrink-0 text-muted-foreground/40"
                : "size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            }
            aria-hidden="true"
          />
        </div>
        <dl className="grid gap-2 text-xs text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">Current Date</dt>
            <dd>{world.inWorldDateLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Player characters</dt>
            <dd>
              {stats === undefined
                ? "—"
                : formatPlayerCharacterCount(stats.playerCharacterCount)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Last turn</dt>
            <dd>
              {stats === undefined
                ? "—"
                : formatLastTurnLabel(stats.lastTransitionAt)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
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
      <User className="size-3" aria-hidden="true" />
      Member
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
        { name },
        {
          onError: (error) => {
            notifyMutationError(error, "Failed to create world.");
          },
          onSuccess: () => {
            notifyMutationSuccess("World created.");
            onClose();
          },
        },
      );
    } else {
      if (dryRunReport !== null && dryRunReport.danglingRefs.length > 0) {
        notifyError("Template has cross-reference errors", {
          description: "Resolve the errors in the template before importing.",
        });
        return;
      }
      importMutation.mutate(
        { name, template: effectiveTemplate },
        {
          onError: (error) => {
            notifyError("Import failed", {
              description: resolveMutationErrorMessage(
                error,
                "Could not import template.",
              ),
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
