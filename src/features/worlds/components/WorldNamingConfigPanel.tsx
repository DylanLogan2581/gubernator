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
import { sanitizePoolEntries } from "@/components/shared/PoolEditorUtils";
import { Button } from "@/components/ui/button";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import {
  NAME_CONVENTIONS,
  type NameConvention,
  type WorldNamingConfig,
} from "@/lib/worldNamingConfigSchemas";

import { saveWorldNamingConfigMutationOptions } from "../mutations/worldNamingConfigMutations";
import { worldNamingConfigQueryOptions } from "../queries/worldNamingConfigQueries";

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
    return <LoadingState label="Loading naming configuration…" />;
  }

  if (configQuery.isError) {
    return (
      <ErrorState
        title="Naming configuration could not be loaded"
        description={
          configQuery.error instanceof Error
            ? configQuery.error.message
            : "Try refreshing the page."
        }
      />
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

  const hasEmptyPool =
    draftConfig.male_given_names.length === 0 ||
    draftConfig.female_given_names.length === 0;
  const showEmptyPoolWarning =
    draftConfig.convention !== "manual" && hasEmptyPool;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const sanitizedConfig: WorldNamingConfig = {
      ...draftConfig,
      female_given_names: sanitizePoolEntries(draftConfig.female_given_names),
      male_given_names: sanitizePoolEntries(draftConfig.male_given_names),
      surnames: sanitizePoolEntries(draftConfig.surnames),
    };
    setDraftConfig(sanitizedConfig);
    saveMutation.mutate(
      { config: sanitizedConfig, worldId },
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
    <div className="grid gap-4">
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
          {hasEmptyPool ? (
            <div className="min-h-[52px]">
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
                    One or more name pools are empty. Random NPC names may be
                    blank unless <strong>manual only</strong> is selected.
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <PoolEditor
            label="Male given name pool"
            entries={draftConfig.male_given_names}
            onChange={(entries) =>
              setDraftConfig((c) => ({ ...c, male_given_names: entries }))
            }
          />

          <PoolEditor
            label="Female given name pool"
            entries={draftConfig.female_given_names}
            onChange={(entries) =>
              setDraftConfig((c) => ({ ...c, female_given_names: entries }))
            }
          />

          <PoolEditor
            label="Surname pool"
            entries={draftConfig.surnames}
            onChange={(entries) =>
              setDraftConfig((c) => ({ ...c, surnames: entries }))
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

function NamingConfigReadOnlySummary({
  config,
}: {
  readonly config: WorldNamingConfig;
}): JSX.Element {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <ReadoutItem
        label="Male given name pool"
        value={
          config.male_given_names.length === 1
            ? "1 entry"
            : `${String(config.male_given_names.length)} entries`
        }
      />
      <ReadoutItem
        label="Female given name pool"
        value={
          config.female_given_names.length === 1
            ? "1 entry"
            : `${String(config.female_given_names.length)} entries`
        }
      />
      <ReadoutItem
        label="Surname pool"
        value={
          config.surnames.length === 1
            ? "1 entry"
            : `${String(config.surnames.length)} entries`
        }
      />
      <ReadoutItem label="Convention" value={config.convention} />
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
