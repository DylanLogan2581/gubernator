import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ResourceAmountListEditor } from "@/components/shared/ResourceAmountListEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";

import { createManagedPopulationTypeInputSchema } from "../../../schemas/managedPopulationSchemas";
import { useManagedPopulationJobRows } from "../hooks/UseManagedPopulationJobRows";
import { usePopulationTypeForm } from "../hooks/UsePopulationTypeForm";
import { resourceEntriesToDtoArray } from "../utils/PopulationTypeFormMapping";

import { ManagedPopulationJobRow } from "./ManagedPopulationJobRow";
import { PopulationTypeScalarFields } from "./PopulationTypeScalarFields";

import type { CreateManagedPopulationTypeInput } from "../../../schemas/managedPopulationSchemas";

export function CreateManagedPopulationTypeForm({
  cullingJobs,
  husbandryJobs,
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateManagedPopulationTypeInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const form = usePopulationTypeForm({
    initialName: "",
    initialSlug: "",
    initialGrowthRate: 0,
    initialMaintenanceRules: [],
    initialCullingOutputs: [],
    initialRegularOutputs: [],
  });
  const husbandryRows = useManagedPopulationJobRows(undefined, "1");
  const cullingRows = useManagedPopulationJobRows(undefined, "10");

  const hasEmptyHusbandryJobSelection = husbandryRows.rows.some(
    (row) => row.jobId === "",
  );
  const hasDuplicateHusbandryJobs = husbandryRows.duplicateJobIds.size > 0;
  const hasEmptyCullingJobSelection = cullingRows.rows.some(
    (row) => row.jobId === "",
  );
  const hasDuplicateCullingJobs = cullingRows.duplicateJobIds.size > 0;
  const hasJobError =
    hasEmptyHusbandryJobSelection ||
    hasDuplicateHusbandryJobs ||
    hasEmptyCullingJobSelection ||
    hasDuplicateCullingJobs;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    form.clearFieldErrors();

    if (hasJobError) return;

    const input: CreateManagedPopulationTypeInput = {
      cullingJobs: cullingRows.rows.map((row) => ({
        jobId: row.jobId,
        maxCullPerWorker:
          row.rateValue !== "" ? parseInt(row.rateValue, 10) : 0,
      })),
      cullingOutputsJson:
        form.cullingOutputs.length > 0
          ? [...resourceEntriesToDtoArray(form.cullingOutputs)]
          : undefined,
      growthRate: form.growthRate,
      husbandryJobs: husbandryRows.rows.map((row) => ({
        jobId: row.jobId,
        workersPerNAnimals:
          row.rateValue !== "" ? parseInt(row.rateValue, 10) : 0,
      })),
      icon: form.icon,
      iconColor: form.iconColor,
      maintenanceRulesJson:
        form.maintenanceRules.length > 0
          ? [...resourceEntriesToDtoArray(form.maintenanceRules)]
          : undefined,
      name: form.name,
      regularOutputsJson:
        form.regularOutputs.length > 0
          ? [...resourceEntriesToDtoArray(form.regularOutputs)]
          : undefined,
      slug: form.slug,
      worldId,
    };

    const result = createManagedPopulationTypeInputSchema.safeParse(input);
    if (!result.success) {
      form.setFromZod(result.error);
      return;
    }

    onSubmit(input);
  }

  const resources = resourcesQuery.data ?? [];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create managed population type</DialogTitle>
            <DialogDescription>
              Define a managed population type and its resource behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <PopulationTypeScalarFields
              fieldErrors={form.fieldErrors}
              growthRate={form.growthRate}
              icon={form.icon}
              iconColor={form.iconColor}
              isPending={isPending}
              name={form.name}
              slug={form.slug}
              onGrowthRateChange={form.setGrowthRate}
              onIconChange={form.setIcon}
              onIconColorChange={form.setIconColor}
              onNameChange={form.handleNameChange}
            />
            {husbandryJobs.length === 0 ? (
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Husbandry jobs</span>
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
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Husbandry jobs
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={husbandryRows.addRow}
                  >
                    <Plus aria-hidden="true" />
                    Add job
                  </Button>
                </div>
                {form.fieldErrors.husbandryJobs !== undefined ? (
                  <p className="text-xs text-destructive">
                    {form.fieldErrors.husbandryJobs}
                  </p>
                ) : null}
                {husbandryRows.rows.map((row, index) => (
                  <ManagedPopulationJobRow
                    key={row.localId}
                    canRemove={husbandryRows.rows.length > 1}
                    disabled={isPending}
                    fieldIdPrefix="husbandry-job"
                    index={index}
                    isDuplicate={husbandryRows.duplicateJobIds.has(row.jobId)}
                    jobId={row.jobId}
                    jobs={husbandryJobs}
                    purposeLabel="Husbandry job"
                    rateLabel="Workers per N animals"
                    rateValue={row.rateValue}
                    onJobIdChange={(jobId) => {
                      husbandryRows.updateRow(row.localId, { jobId });
                    }}
                    onRateValueChange={(rateValue) => {
                      husbandryRows.updateRow(row.localId, { rateValue });
                    }}
                    onRemove={() => {
                      husbandryRows.removeRow(row.localId);
                    }}
                  />
                ))}
              </div>
            )}
            {cullingJobs.length === 0 ? (
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Culling jobs</span>
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
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Culling jobs
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={cullingRows.addRow}
                  >
                    <Plus aria-hidden="true" />
                    Add job
                  </Button>
                </div>
                {form.fieldErrors.cullingJobs !== undefined ? (
                  <p className="text-xs text-destructive">
                    {form.fieldErrors.cullingJobs}
                  </p>
                ) : null}
                {cullingRows.rows.map((row, index) => (
                  <ManagedPopulationJobRow
                    key={row.localId}
                    canRemove={cullingRows.rows.length > 1}
                    disabled={isPending}
                    fieldIdPrefix="culling-job"
                    index={index}
                    isDuplicate={cullingRows.duplicateJobIds.has(row.jobId)}
                    jobId={row.jobId}
                    jobs={cullingJobs}
                    purposeLabel="Culling job"
                    rateLabel="Max cull per worker"
                    rateValue={row.rateValue}
                    onJobIdChange={(jobId) => {
                      cullingRows.updateRow(row.localId, { jobId });
                    }}
                    onRateValueChange={(rateValue) => {
                      cullingRows.updateRow(row.localId, { rateValue });
                    }}
                    onRemove={() => {
                      cullingRows.removeRow(row.localId);
                    }}
                  />
                ))}
              </div>
            )}
            <ResourceAmountListEditor
              addLabel="Add entry"
              amountLabel="amount per N animals"
              disabled={isPending}
              entries={form.maintenanceRules}
              label="Maintenance rules"
              resources={resources}
              onChange={form.setMaintenanceRules}
            />
            <ResourceAmountListEditor
              addLabel="Add entry"
              amountLabel="amount per N animals"
              disabled={isPending}
              entries={form.cullingOutputs}
              label="Culling outputs"
              resources={resources}
              onChange={form.setCullingOutputs}
            />
            <ResourceAmountListEditor
              addLabel="Add entry"
              amountLabel="amount per N animals"
              disabled={isPending}
              entries={form.regularOutputs}
              label="Regular outputs"
              resources={resources}
              onChange={form.setRegularOutputs}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending || hasJobError} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
