import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { RotateCw, Save, Sparkles } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { sanitizePoolEntries } from "@/components/shared/PoolEditorUtils";
import { TagListEditor } from "@/components/shared/TagListEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateNpcFlavor, renderNpcFlavorLine } from "@/features/citizens";
import { activeJobsByWorldQueryOptions } from "@/features/jobs";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { npcFlavorInputLimits } from "@/lib/inputLimits";
import {
  notifyMutationError,
  notifyMutationSuccess,
  resolveMutationErrorMessage,
} from "@/lib/notify";
import { createSeededRng } from "@/lib/seededRng";

import { saveWorldNpcFlavorConfigMutationOptions } from "../mutations/worldNpcFlavorConfigMutations";
import { worldNpcFlavorConfigQueryOptions } from "../queries/worldNpcFlavorConfigQueries";

import type { WorldNpcFlavorConfig } from "../schemas/worldNpcFlavorConfigSchemas";
import type { WorldPermissionContext } from "../types/worldTypes";

type WorldNpcFlavorConfigPanelProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function WorldNpcFlavorConfigPanel({
  accessContext,
  canAdmin,
  isArchived,
  worldId,
}: WorldNpcFlavorConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const configQuery = useQuery(worldNpcFlavorConfigQueryOptions(worldId));

  if (configQuery.isPending) {
    return <LoadingState label="Loading NPC flavor pools…" />;
  }

  if (configQuery.isError) {
    return (
      <ErrorState
        title="NPC flavor pools could not be loaded"
        description={resolveMutationErrorMessage(configQuery.error)}
      />
    );
  }

  return (
    <WorldNpcFlavorConfigPanelContent
      key={worldId}
      accessContext={accessContext}
      canAdmin={canAdmin}
      initialConfig={configQuery.data}
      isArchived={isArchived}
      queryClient={queryClient}
      worldId={worldId}
    />
  );
}

function WorldNpcFlavorConfigPanelContent({
  accessContext,
  canAdmin,
  initialConfig,
  isArchived,
  queryClient,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly initialConfig: WorldNpcFlavorConfig;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const saveMutation = useMutation(
    saveWorldNpcFlavorConfigMutationOptions({
      accessContext,
      queryClient,
    }),
  );
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));
  const [draftConfig, setDraftConfig] =
    useState<WorldNpcFlavorConfig>(initialConfig);
  const [exampleOutput, setExampleOutput] = useState<string | null>(null);
  const [exampleDialogOpen, setExampleDialogOpen] = useState(false);
  const [previewSeed, setPreviewSeed] = useState<number>(0);
  const [isDirty, setIsDirty] = useState(false);
  const unsavedChangesDialog = useUnsavedChangesGuard(isDirty);

  const canEdit = canAdmin && !isArchived;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const sanitizedConfig: WorldNpcFlavorConfig = {
      contradictions: sanitizePoolEntries(draftConfig.contradictions),
      flaws: sanitizePoolEntries(draftConfig.flaws),
      goals: sanitizePoolEntries(draftConfig.goals),
      traits: sanitizePoolEntries(draftConfig.traits),
    };
    setDraftConfig(sanitizedConfig);
    saveMutation.mutate(
      { config: sanitizedConfig, worldId },
      {
        onError: (error) => {
          notifyMutationError(error);
        },
        onSuccess: () => {
          setIsDirty(false);
          notifyMutationSuccess("NPC flavor pools saved.");
        },
      },
    );
  }

  function handleGenerateExample(): void {
    const rng = createSeededRng(previewSeed);
    setPreviewSeed((current) => current + 1);
    const flavor = generateNpcFlavor(draftConfig, rng);

    // Get random job name from world jobs, fallback to "Worker"
    let roleLabel = "Worker";
    if (jobsQuery.data !== undefined && jobsQuery.data.length > 0) {
      const jobIndex = Math.floor(rng() * jobsQuery.data.length);
      const randomJob = jobsQuery.data[jobIndex];
      if (randomJob !== undefined) {
        roleLabel = randomJob.name;
      }
    }

    setExampleOutput(renderNpcFlavorLine(flavor, roleLabel));
    setExampleDialogOpen(true);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            id="world-npc-flavor-title"
            className="text-lg font-semibold tracking-normal"
          >
            NPC flavor pools
          </h2>
          {canEdit && (
            <p className="text-sm text-muted-foreground">
              World admins can edit the option pools used to generate NPC
              flavor.
            </p>
          )}
        </div>
        {!canEdit ? (
          <span className="inline-flex w-fit rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
            Read-only
          </span>
        ) : null}
      </div>

      {canEdit ? (
        <>
          <form
            aria-label="World NPC flavor pool configuration"
            className="grid gap-5"
            noValidate
            onSubmit={handleSubmit}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TagListEditor
                label="Traits"
                entries={draftConfig.traits}
                maxEntryLength={npcFlavorInputLimits.poolEntryMax}
                maxPoolSize={npcFlavorInputLimits.poolSizeMax}
                searchable
                scrollAreaClassName="h-96"
                onChange={(traits) => {
                  setDraftConfig((current) => ({ ...current, traits }));
                  setIsDirty(true);
                }}
              />
              <TagListEditor
                label="Contradictions"
                entries={draftConfig.contradictions}
                maxEntryLength={npcFlavorInputLimits.poolEntryMax}
                maxPoolSize={npcFlavorInputLimits.poolSizeMax}
                searchable
                scrollAreaClassName="h-96"
                onChange={(contradictions) => {
                  setDraftConfig((current) => ({
                    ...current,
                    contradictions,
                  }));
                  setIsDirty(true);
                }}
              />
              <TagListEditor
                label="Goals"
                entries={draftConfig.goals}
                maxEntryLength={npcFlavorInputLimits.poolEntryMax}
                maxPoolSize={npcFlavorInputLimits.poolSizeMax}
                searchable
                scrollAreaClassName="h-96"
                onChange={(goals) => {
                  setDraftConfig((current) => ({ ...current, goals }));
                  setIsDirty(true);
                }}
              />
              <TagListEditor
                label="Flaws"
                entries={draftConfig.flaws}
                maxEntryLength={npcFlavorInputLimits.poolEntryMax}
                maxPoolSize={npcFlavorInputLimits.poolSizeMax}
                searchable
                scrollAreaClassName="h-96"
                onChange={(flaws) => {
                  setDraftConfig((current) => ({ ...current, flaws }));
                  setIsDirty(true);
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                <Save aria-hidden="true" />
                Save pools
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateExample}
              >
                <Sparkles aria-hidden="true" />
                Generate example output
              </Button>
            </div>
          </form>

          <Dialog open={exampleDialogOpen} onOpenChange={setExampleDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Example output</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-foreground">{exampleOutput}</p>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateExample}
                >
                  <RotateCw aria-hidden="true" />
                  Regenerate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <NpcFlavorPoolReadOnlySummary config={draftConfig} />
      )}
      {unsavedChangesDialog}
    </div>
  );
}

function NpcFlavorPoolReadOnlySummary({
  config,
}: {
  readonly config: WorldNpcFlavorConfig;
}): JSX.Element {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <PoolCountReadout label="Traits" count={config.traits.length} />
      <PoolCountReadout
        label="Contradictions"
        count={config.contradictions.length}
      />
      <PoolCountReadout label="Goals" count={config.goals.length} />
      <PoolCountReadout label="Flaws" count={config.flaws.length} />
    </dl>
  );
}

function PoolCountReadout({
  count,
  label,
}: {
  readonly count: number;
  readonly label: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {count === 1 ? "1 entry" : `${String(count)} entries`}
      </dd>
    </div>
  );
}
