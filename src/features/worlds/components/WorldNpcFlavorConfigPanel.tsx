import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Plus, RotateCcw, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyMutationSuccess } from "@/lib/notify";

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
    return (
      <section
        aria-labelledby="world-npc-flavor-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading NPC flavor pools…" />
      </section>
    );
  }

  if (configQuery.isError) {
    return (
      <section
        aria-labelledby="world-npc-flavor-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="NPC flavor pools could not be loaded"
          description={getNpcFlavorErrorDescription(configQuery.error)}
        />
      </section>
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
  const [draftConfig, setDraftConfig] =
    useState<WorldNpcFlavorConfig>(initialConfig);

  const canEdit = canAdmin && !isArchived;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveMutation.mutate(
      { config: draftConfig, worldId },
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

  function resetDraftConfig(): void {
    setDraftConfig(initialConfig);
  }

  return (
    <section
      aria-labelledby="world-npc-flavor-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            id="world-npc-flavor-title"
            className="text-lg font-semibold tracking-normal"
          >
            NPC flavor pools
          </h2>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "World admins can edit the option pools used to generate NPC flavor."
              : "NPC flavor pool configuration is read-only for your current access."}
          </p>
        </div>
        {!canEdit ? (
          <span className="inline-flex w-fit rounded-sm bg-muted px-2 py-1 text-xs text-muted-foreground">
            Read-only
          </span>
        ) : null}
      </div>

      {canEdit ? (
        <form
          aria-label="World NPC flavor pool configuration"
          className="grid gap-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <PoolEditor
            label="Traits"
            entries={draftConfig.traits}
            onChange={(traits) =>
              setDraftConfig((current) => ({ ...current, traits }))
            }
          />
          <PoolEditor
            label="Contradictions"
            entries={draftConfig.contradictions}
            onChange={(contradictions) =>
              setDraftConfig((current) => ({ ...current, contradictions }))
            }
          />
          <PoolEditor
            label="Goals"
            entries={draftConfig.goals}
            onChange={(goals) =>
              setDraftConfig((current) => ({ ...current, goals }))
            }
          />
          <PoolEditor
            label="Flaws"
            entries={draftConfig.flaws}
            onChange={(flaws) =>
              setDraftConfig((current) => ({ ...current, flaws }))
            }
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save aria-hidden="true" />
              Save pools
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetDraftConfig}
              disabled={saveMutation.isPending}
            >
              <RotateCcw aria-hidden="true" />
              Reset
            </Button>
          </div>
        </form>
      ) : (
        <NpcFlavorPoolReadOnlySummary config={draftConfig} />
      )}
    </section>
  );
}

function PoolEditor({
  entries,
  label,
  onChange,
}: {
  readonly entries: readonly string[];
  readonly label: string;
  readonly onChange: (entries: string[]) => void;
}): JSX.Element {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{label}</legend>
      {entries.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">No entries yet.</p>
      ) : (
        <ul className="grid gap-1.5">
          {entries.map((entry, index) => (
            <li key={index} className="flex gap-2">
              <Input
                value={entry}
                onChange={(event) => {
                  const next = [...entries];
                  next[index] = event.currentTarget.value;
                  onChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove entry ${String(index + 1)}`}
                onClick={() => {
                  const next = entries.filter((_, i) => i !== index);
                  onChange(next);
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...entries, ""])}
        >
          <Plus aria-hidden="true" />
          Add entry
        </Button>
      </div>
    </fieldset>
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
