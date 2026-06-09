import { Link } from "@tanstack/react-router";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PercentInput } from "@/components/shared/PercentInput";
import { SlugHint } from "@/components/shared/SlugHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { JobDefinition } from "@/features/jobs";
import { managedPopulationInputLimits } from "@/lib/inputLimits";
import { sortByName } from "@/lib/sortUtils";

import type {
  ManagedPopulationTypeFieldErrors,
} from "../hooks/usePopulationTypeForm";

type PopulationTypeScalarFieldsProps = {
  readonly cullingJobId: string;
  readonly cullingJobLinkError: string | undefined;
  readonly cullingJobs: readonly JobDefinition[];
  readonly fieldErrors: ManagedPopulationTypeFieldErrors;
  readonly growthRate: number;
  readonly husbandryJobId: string;
  readonly husbandryJobLinkError: string | undefined;
  readonly husbandryJobs: readonly JobDefinition[];
  readonly husbandryWorkersPerNAnimals: string;
  readonly isPending: boolean;
  readonly jobCollisionError: string | undefined;
  readonly name: string;
  readonly slug: string;
  readonly worldId: string;
  readonly onCullingJobChange: (value: string) => void;
  readonly onGrowthRateChange: (value: number) => void;
  readonly onHusbandryJobChange: (value: string) => void;
  readonly onHusbandryWorkersPerNAnimalsChange: (value: string) => void;
  readonly onNameChange: (value: string) => void;
};

export function PopulationTypeScalarFields({
  cullingJobId,
  cullingJobLinkError,
  cullingJobs,
  fieldErrors,
  growthRate,
  husbandryJobId,
  husbandryJobLinkError,
  husbandryJobs,
  husbandryWorkersPerNAnimals,
  isPending,
  jobCollisionError,
  name,
  slug,
  worldId,
  onCullingJobChange,
  onGrowthRateChange,
  onHusbandryJobChange,
  onHusbandryWorkersPerNAnimalsChange,
  onNameChange,
}: PopulationTypeScalarFieldsProps): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Label className="grid gap-1 text-sm" htmlFor="population-name">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={fieldErrors.name !== undefined}
          aria-label="Name"
          disabled={isPending}
          id="population-name"
          maxLength={managedPopulationInputLimits.populationTypeNameMax}
          value={name}
          onChange={(e) => {
            onNameChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.name !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        ) : null}
        <SlugHint slug={slug} error={fieldErrors.slug} />
      </Label>
      {husbandryJobs.length === 0 ? (
        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Husbandry job</span>
          <EmptyState
            title="No husbandry jobs yet"
            description="Create one to assign to this population type."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/worlds/$worldId/configuration"
                  params={{ worldId }}
                  search={{ tab: "jobs" }}
                >
                  Create husbandry job
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <Label className="grid gap-1 text-sm" htmlFor="husbandry-job">
          <span className="text-muted-foreground">Husbandry job</span>
          <NativeSelect
            aria-invalid={
              fieldErrors.husbandryJobId !== undefined ||
              husbandryJobLinkError !== undefined ||
              jobCollisionError !== undefined
            }
            className="w-full"
            disabled={isPending}
            id="husbandry-job"
            value={husbandryJobId}
            onChange={(e) => {
              onHusbandryJobChange(e.currentTarget.value);
            }}
          >
            <option value="">Select a husbandry job…</option>
            {sortByName(husbandryJobs).map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </NativeSelect>
          {husbandryJobLinkError !== undefined ? (
            <p className="text-xs text-destructive">{husbandryJobLinkError}</p>
          ) : jobCollisionError !== undefined ? (
            <p className="text-xs text-destructive">{jobCollisionError}</p>
          ) : fieldErrors.husbandryJobId !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.husbandryJobId}
            </p>
          ) : null}
        </Label>
      )}
      {cullingJobs.length === 0 ? (
        <div className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Culling job</span>
          <EmptyState
            title="No culling jobs yet"
            description="Create one to assign to this population type."
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/worlds/$worldId/configuration"
                  params={{ worldId }}
                  search={{ tab: "jobs" }}
                >
                  Create culling job
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <Label className="grid gap-1 text-sm" htmlFor="culling-job">
          <span className="text-muted-foreground">Culling job</span>
          <NativeSelect
            aria-invalid={
              fieldErrors.cullingJobId !== undefined ||
              cullingJobLinkError !== undefined ||
              jobCollisionError !== undefined
            }
            className="w-full"
            disabled={isPending}
            id="culling-job"
            value={cullingJobId}
            onChange={(e) => {
              onCullingJobChange(e.currentTarget.value);
            }}
          >
            <option value="">Select a culling job…</option>
            {sortByName(cullingJobs).map((job) => (
              <option key={job.id} value={job.id}>
                {job.name}
              </option>
            ))}
          </NativeSelect>
          {cullingJobLinkError !== undefined ? (
            <p className="text-xs text-destructive">{cullingJobLinkError}</p>
          ) : jobCollisionError !== undefined ? (
            <p className="text-xs text-destructive">{jobCollisionError}</p>
          ) : fieldErrors.cullingJobId !== undefined ? (
            <p className="text-xs text-destructive">
              {fieldErrors.cullingJobId}
            </p>
          ) : null}
        </Label>
      )}
      <Label className="grid gap-1 text-sm" htmlFor="husbandry-workers">
        <span className="text-muted-foreground">
          Husbandry workers per N animals
        </span>
        <Input
          aria-invalid={fieldErrors.husbandryWorkersPerNAnimals !== undefined}
          disabled={isPending}
          id="husbandry-workers"
          inputMode="numeric"
          placeholder="1"
          value={husbandryWorkersPerNAnimals}
          onChange={(e) => {
            onHusbandryWorkersPerNAnimalsChange(e.currentTarget.value);
          }}
        />
        {fieldErrors.husbandryWorkersPerNAnimals !== undefined ? (
          <p className="text-xs text-destructive">
            {fieldErrors.husbandryWorkersPerNAnimals}
          </p>
        ) : null}
      </Label>
      <div className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Growth rate</span>
        <PercentInput
          aria-invalid={fieldErrors.growthRate !== undefined}
          aria-label="Growth rate"
          disabled={isPending}
          value={growthRate}
          onChange={onGrowthRateChange}
        />
        {fieldErrors.growthRate !== undefined ? (
          <p className="text-xs text-destructive">{fieldErrors.growthRate}</p>
        ) : null}
      </div>
    </div>
  );
}
