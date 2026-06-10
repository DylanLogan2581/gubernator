import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PercentInput } from "@/components/shared/PercentInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { saveWorldPopulationRulesMutationOptions } from "../mutations/worldPopulationRulesMutations";
import { worldPopulationRulesQueryOptions } from "../queries/worldPopulationRulesQueries";

import type { WorldPopulationRules } from "../schemas/worldPopulationRulesSchemas";
import type { WorldPermissionContext } from "../types/worldTypes";

type WorldPopulationRulesConfigPanelProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function WorldPopulationRulesConfigPanel({
  accessContext,
  canAdmin,
  isArchived,
  worldId,
}: WorldPopulationRulesConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery(worldPopulationRulesQueryOptions(worldId));

  if (rulesQuery.isPending) {
    return <LoadingState label="Loading population rules…" />;
  }

  if (rulesQuery.isError) {
    return (
      <ErrorState
        title="Population rules could not be loaded"
        description={
          rulesQuery.error instanceof Error
            ? rulesQuery.error.message
            : "Try refreshing the page."
        }
      />
    );
  }

  return (
    <WorldPopulationRulesConfigPanelContent
      key={worldId}
      accessContext={accessContext}
      canAdmin={canAdmin}
      initialRules={rulesQuery.data}
      isArchived={isArchived}
      queryClient={queryClient}
      worldId={worldId}
    />
  );
}

function WorldPopulationRulesConfigPanelContent({
  accessContext,
  canAdmin,
  initialRules,
  isArchived,
  queryClient,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly initialRules: WorldPopulationRules;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const saveMutation = useMutation(
    saveWorldPopulationRulesMutationOptions({
      accessContext,
      queryClient,
    }),
  );
  const [draftRules, setDraftRules] =
    useState<WorldPopulationRules>(initialRules);

  const canEdit = canAdmin && !isArchived;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveMutation.mutate(
      { rules: draftRules, worldId },
      {
        onError: (error) => {
          notifyMutationError(error, "Population rules could not be saved.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Population rules saved.");
        },
      },
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2
            id="world-population-rules-title"
            className="text-lg font-semibold tracking-normal"
          >
            Population rules
          </h2>
          {canEdit && (
            <p className="text-sm text-muted-foreground">
              World admins can tune the scalar rules that govern population
              simulation.
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
        <form
          aria-label="World population rules configuration"
          className="grid gap-6"
          noValidate
          onSubmit={handleSubmit}
        >
          <fieldset className="grid gap-3">
            <legend className="text-base font-semibold">
              Partnership and fertility
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <PercentRuleField
                label="Partnership seek chance"
                hint="Probability (0–100%)"
                value={draftRules.partnership_seek_chance}
                onChange={(value) =>
                  setDraftRules((r) => ({
                    ...r,
                    partnership_seek_chance: value,
                  }))
                }
              />
              <PercentRuleField
                label="Fertility chance"
                hint="Probability (0–100%)"
                value={draftRules.fertility_chance}
                onChange={(value) =>
                  setDraftRules((r) => ({ ...r, fertility_chance: value }))
                }
              />
              <NumberRuleField
                label="Minimum partnership age"
                hint="Turns (integer ≥ 0)"
                min={0}
                step={1}
                value={draftRules.minimum_partnership_age_turns}
                onChange={(value) =>
                  setDraftRules((r) => ({
                    ...r,
                    minimum_partnership_age_turns: value,
                  }))
                }
              />
              <NullableNumberRuleField
                label="Maximum fertility age"
                hint="Turns (integer ≥ 0); leave empty for no cap"
                min={0}
                value={draftRules.maximum_fertility_age_turns}
                onChange={(value) =>
                  setDraftRules((r) => ({
                    ...r,
                    maximum_fertility_age_turns: value,
                  }))
                }
              />
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-base font-semibold">Lifecycle</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberRuleField
                label="Mourning period"
                hint="Turns (integer ≥ 0)"
                min={0}
                step={1}
                value={draftRules.mourning_period_turns}
                onChange={(value) =>
                  setDraftRules((r) => ({ ...r, mourning_period_turns: value }))
                }
              />
              <NumberRuleField
                label="Incest prevention depth"
                hint="Generations [0–10]; 0 disables the check"
                min={0}
                max={10}
                step={1}
                value={draftRules.incest_prevention_depth}
                onChange={(value) =>
                  setDraftRules((r) => ({
                    ...r,
                    incest_prevention_depth: value,
                  }))
                }
              />
            </div>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-base font-semibold">
              Resource consumption
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberRuleField
                label="Food consumption per citizen"
                hint="Per-citizen amount (decimal ≥ 0)"
                min={0}
                step={0.01}
                value={draftRules.food_consumption_per_citizen}
                onChange={(value) =>
                  setDraftRules((r) => ({
                    ...r,
                    food_consumption_per_citizen: value,
                  }))
                }
              />
              <NumberRuleField
                label="Water consumption per citizen"
                hint="Per-citizen amount (decimal ≥ 0)"
                min={0}
                step={0.01}
                value={draftRules.water_consumption_per_citizen}
                onChange={(value) =>
                  setDraftRules((r) => ({
                    ...r,
                    water_consumption_per_citizen: value,
                  }))
                }
              />
              <NumberRuleField
                label="Homelessness decline rate"
                hint="Decimal ≥ 0"
                min={0}
                step={0.01}
                value={draftRules.homelessness_decline_rate}
                onChange={(value) =>
                  setDraftRules((r) => ({
                    ...r,
                    homelessness_decline_rate: value,
                  }))
                }
              />
              <NumberRuleField
                label="Starvation severity multiplier"
                hint="Multiplier (decimal ≥ 0)"
                min={0}
                step={0.01}
                value={draftRules.starvation_severity_multiplier}
                onChange={(value) =>
                  setDraftRules((r) => ({
                    ...r,
                    starvation_severity_multiplier: value,
                  }))
                }
              />
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save aria-hidden="true" />
              Save rules
            </Button>
          </div>
        </form>
      ) : (
        <PopulationRulesReadOnlySummary rules={draftRules} />
      )}
    </div>
  );
}

function NumberRuleField({
  hint,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  readonly hint: string;
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly onChange: (value: number) => void;
  readonly step?: number;
  readonly value: number;
}): JSX.Element {
  return (
    <Label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Label>
  );
}

function PercentRuleField({
  hint,
  label,
  onChange,
  value,
}: {
  readonly hint: string;
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}): JSX.Element {
  return (
    <Label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <PercentInput value={value} onChange={onChange} />
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Label>
  );
}

function NullableNumberRuleField({
  hint,
  label,
  min,
  onChange,
  value,
}: {
  readonly hint: string;
  readonly label: string;
  readonly min?: number;
  readonly onChange: (value: number | null) => void;
  readonly value: number | null;
}): JSX.Element {
  return (
    <Label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type="number"
        min={min}
        step={1}
        value={value ?? ""}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          onChange(raw === "" ? null : Number(raw));
        }}
      />
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Label>
  );
}

function PopulationRulesReadOnlySummary({
  rules,
}: {
  readonly rules: WorldPopulationRules;
}): JSX.Element {
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <ReadoutItem
        label="Partnership seek chance"
        value={`${String(Math.round(rules.partnership_seek_chance * 100))}%`}
      />
      <ReadoutItem
        label="Fertility chance"
        value={`${String(Math.round(rules.fertility_chance * 100))}%`}
      />
      <ReadoutItem
        label="Minimum partnership age"
        value={`${String(rules.minimum_partnership_age_turns)} turns`}
      />
      <ReadoutItem
        label="Maximum fertility age"
        value={
          rules.maximum_fertility_age_turns === null
            ? "No cap"
            : `${String(rules.maximum_fertility_age_turns)} turns`
        }
      />
      <ReadoutItem
        label="Mourning period"
        value={`${String(rules.mourning_period_turns)} turns`}
      />
      <ReadoutItem
        label="Incest prevention depth"
        value={String(rules.incest_prevention_depth)}
      />
      <ReadoutItem
        label="Food consumption per citizen"
        value={String(rules.food_consumption_per_citizen)}
      />
      <ReadoutItem
        label="Water consumption per citizen"
        value={String(rules.water_consumption_per_citizen)}
      />
      <ReadoutItem
        label="Homelessness decline rate"
        value={String(rules.homelessness_decline_rate)}
      />
      <ReadoutItem
        label="Starvation severity multiplier"
        value={String(rules.starvation_severity_multiplier)}
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
