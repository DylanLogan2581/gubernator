import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PoolEditor } from "@/components/shared/PoolEditor";
import { Button } from "@/components/ui/button";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { saveWorldNamingConfigMutationOptions } from "../mutations/worldNamingConfigMutations";
import { worldNamingConfigQueryOptions } from "../queries/worldNamingConfigQueries";
import {
  NAME_CONVENTIONS,
  type NameConvention,
  type WorldNamingConfig,
} from "../schemas/worldNamingConfigSchemas";

import type { WorldPermissionContext } from "../types/worldTypes";

type WorldNamingConfigPanelProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function WorldNamingConfigPanel({
  accessContext,
  canAdmin,
  isArchived,
  worldId,
}: WorldNamingConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const configQuery = useQuery(worldNamingConfigQueryOptions(worldId));

  if (configQuery.isPending) {
    return (
      <section
        aria-labelledby="world-naming-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading naming configuration…" />
      </section>
    );
  }

  if (configQuery.isError) {
    return (
      <section
        aria-labelledby="world-naming-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Naming configuration could not be loaded"
          description={
            configQuery.error instanceof Error
              ? configQuery.error.message
              : "Try refreshing the page."
          }
        />
      </section>
    );
  }

  return (
    <WorldNamingConfigPanelContent
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

function WorldNamingConfigPanelContent({
  accessContext,
  canAdmin,
  initialConfig,
  isArchived,
  queryClient,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly initialConfig: WorldNamingConfig;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const saveMutation = useMutation(
    saveWorldNamingConfigMutationOptions({
      accessContext,
      queryClient,
    }),
  );
  const [draftConfig, setDraftConfig] =
    useState<WorldNamingConfig>(initialConfig);

  const canEdit = canAdmin && !isArchived;

  const showEmptyPoolWarning =
    !draftConfig.manual_only &&
    (draftConfig.male_names.length === 0 ||
      draftConfig.female_names.length === 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveMutation.mutate(
      { config: draftConfig, worldId },
      {
        onError: (error) => {
          notifyMutationError(
            error,
            "Naming configuration could not be saved.",
          );
        },
        onSuccess: () => {
          notifyMutationSuccess("Naming configuration saved.");
        },
      },
    );
  }

  function resetDraftConfig(): void {
    setDraftConfig(initialConfig);
  }

  return (
    <section
      aria-labelledby="world-naming-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            id="world-naming-title"
            className="text-lg font-semibold tracking-normal"
          >
            Naming rules
          </h2>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "World admins can configure name pools and conventions for random NPC creation."
              : "Naming configuration is read-only for your current access."}
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
          aria-label="World naming configuration"
          className="grid gap-6"
          noValidate
          onSubmit={handleSubmit}
        >
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
                unless <strong>manual only</strong> is enabled.
              </span>
            </div>
          ) : null}

          <PoolEditor
            label="Male name pool"
            entries={draftConfig.male_names}
            onChange={(maleNames) =>
              setDraftConfig((c) => ({ ...c, male_names: maleNames }))
            }
          />

          <PoolEditor
            label="Female name pool"
            entries={draftConfig.female_names}
            onChange={(femaleNames) =>
              setDraftConfig((c) => ({ ...c, female_names: femaleNames }))
            }
          />

          <fieldset className="grid gap-2">
            <legend className="text-base font-semibold">
              Naming convention
            </legend>
            <div className="grid gap-1.5">
              {NAME_CONVENTIONS.map((convention) => (
                <label
                  key={convention}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="convention"
                    className="h-4 w-4 accent-primary"
                    value={convention}
                    checked={draftConfig.convention === convention}
                    onChange={() =>
                      setDraftConfig((c) => ({ ...c, convention }))
                    }
                  />
                  <ConventionLabel convention={convention} />
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={draftConfig.manual_only}
              onChange={(event) =>
                setDraftConfig((c) => ({
                  ...c,
                  manual_only: event.currentTarget.checked,
                }))
              }
            />
            <span className="font-medium">Manual only</span>
            <span className="text-xs text-muted-foreground">
              — disable automatic name generation; names must be set manually
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save aria-hidden="true" />
              Save naming rules
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
        <NamingConfigReadOnlySummary config={draftConfig} />
      )}
    </section>
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
  }
}

function NamingConfigReadOnlySummary({
  config,
}: {
  readonly config: WorldNamingConfig;
}): JSX.Element {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <ReadoutItem
        label="Male name pool"
        value={
          config.male_names.length === 1
            ? "1 entry"
            : `${String(config.male_names.length)} entries`
        }
      />
      <ReadoutItem
        label="Female name pool"
        value={
          config.female_names.length === 1
            ? "1 entry"
            : `${String(config.female_names.length)} entries`
        }
      />
      <ReadoutItem label="Convention" value={config.convention} />
      <ReadoutItem
        label="Manual only"
        value={config.manual_only ? "Yes" : "No"}
      />
    </dl>
  );
}

function ReadoutItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
