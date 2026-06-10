import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Save, Sparkles } from "lucide-react";
import { Tabs } from "radix-ui";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PoolEditor } from "@/components/shared/PoolEditor";
import { sanitizePoolEntries } from "@/components/shared/PoolEditorUtils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { generateNpcFlavor, renderNpcFlavorLine } from "@/features/citizens";
import { activeJobsByWorldQueryOptions } from "@/features/jobs";
import { notifyMutationSuccess } from "@/lib/notify";
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
        description={getNpcFlavorErrorDescription(configQuery.error)}
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
          toast.error(getNpcFlavorErrorDescription(error));
        },
        onSuccess: () => {
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
            <Tabs.Root defaultValue="traits">
              <Tabs.List className="flex gap-1 rounded-md border border-border bg-muted p-1">
                <NpcFlavorTab
                  value="traits"
                  label="Traits"
                  count={draftConfig.traits.length}
                />
                <NpcFlavorTab
                  value="contradictions"
                  label="Contradictions"
                  count={draftConfig.contradictions.length}
                />
                <NpcFlavorTab
                  value="goals"
                  label="Goals"
                  count={draftConfig.goals.length}
                />
                <NpcFlavorTab
                  value="flaws"
                  label="Flaws"
                  count={draftConfig.flaws.length}
                />
              </Tabs.List>
              <Tabs.Content value="traits" className="mt-3">
                <PoolEditor
                  label="Traits"
                  entries={draftConfig.traits}
                  onChange={(traits) =>
                    setDraftConfig((current) => ({ ...current, traits }))
                  }
                />
              </Tabs.Content>
              <Tabs.Content value="contradictions" className="mt-3">
                <PoolEditor
                  label="Contradictions"
                  entries={draftConfig.contradictions}
                  onChange={(contradictions) =>
                    setDraftConfig((current) => ({
                      ...current,
                      contradictions,
                    }))
                  }
                />
              </Tabs.Content>
              <Tabs.Content value="goals" className="mt-3">
                <PoolEditor
                  label="Goals"
                  entries={draftConfig.goals}
                  onChange={(goals) =>
                    setDraftConfig((current) => ({ ...current, goals }))
                  }
                />
              </Tabs.Content>
              <Tabs.Content value="flaws" className="mt-3">
                <PoolEditor
                  label="Flaws"
                  entries={draftConfig.flaws}
                  onChange={(flaws) =>
                    setDraftConfig((current) => ({ ...current, flaws }))
                  }
                />
              </Tabs.Content>
            </Tabs.Root>

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
              <p className="text-sm text-foreground">{exampleOutput}</p>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <NpcFlavorPoolReadOnlySummary config={draftConfig} />
      )}
    </div>
  );
}

function NpcFlavorTab({
  count,
  label,
  value,
}: {
  readonly count: number;
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <Tabs.Trigger
      value={value}
      className="flex-1 rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground"
    >
      {label}
      {count > 0 ? (
        <span className="ml-1 opacity-60">({String(count)})</span>
      ) : null}
    </Tabs.Trigger>
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

function getNpcFlavorErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
