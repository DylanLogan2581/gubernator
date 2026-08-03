import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ResourceAmountListEditor } from "@/components/shared/ResourceAmountListEditor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  softDeleteManagedPopulationTypeMutationOptions,
  updateManagedPopulationTypeMutationOptions,
} from "../../../mutations/managedPopulationsMutations";
import { updateManagedPopulationTypeInputSchema } from "../../../schemas/managedPopulationSchemas";
import {
  useManagedPopulationJobRows,
  type ManagedPopulationJobRowState,
} from "../hooks/UseManagedPopulationJobRows";
import { usePopulationTypeForm } from "../hooks/UsePopulationTypeForm";
import {
  databaseResourcesToEntries,
  resourceEntriesToDtoArray,
} from "../utils/PopulationTypeFormMapping";

import { ManagedPopulationJobRow } from "./ManagedPopulationJobRow";
import { PopulationTypeScalarFields } from "./PopulationTypeScalarFields";

import type { UpdateManagedPopulationTypeInput } from "../../../schemas/managedPopulationSchemas";
import type { ManagedPopulationType } from "../../../types/managedPopulationTypes";

function toInitialHusbandryRows(
  populationType: ManagedPopulationType,
): readonly ManagedPopulationJobRowState[] {
  return populationType.husbandryJobs.map((job) => ({
    localId: job.id,
    jobId: job.jobId,
    rateValue: String(job.workersPerNAnimals),
  }));
}

function toInitialCullingRows(
  populationType: ManagedPopulationType,
): readonly ManagedPopulationJobRowState[] {
  return populationType.cullingJobs.map((job) => ({
    localId: job.id,
    jobId: job.jobId,
    rateValue: String(job.maxCullPerWorker),
  }));
}

export function EditManagedPopulationTypeForm({
  cullingJobs,
  husbandryJobs,
  populationType,
  onClose,
  queryClient,
  worldId,
}: {
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly onClose: () => void;
  readonly populationType: ManagedPopulationType;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const updateMutation = useMutation(
    updateManagedPopulationTypeMutationOptions({ queryClient }),
  );
  const softDeleteMutation = useMutation(
    softDeleteManagedPopulationTypeMutationOptions({ queryClient }),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const form = usePopulationTypeForm({
    initialName: populationType.name,
    initialSlug: populationType.slug,
    initialGrowthRate: populationType.growthRate,
    initialIcon: populationType.icon,
    initialIconColor: populationType.iconColor as CategoricalSlot | null,
    initialMaintenanceRules: databaseResourcesToEntries(
      populationType.maintenanceRulesJson,
    ),
    initialCullingOutputs: databaseResourcesToEntries(
      populationType.cullingOutputsJson,
    ),
    initialRegularOutputs: databaseResourcesToEntries(
      populationType.regularOutputsJson,
    ),
  });
  const husbandryRows = useManagedPopulationJobRows(
    toInitialHusbandryRows(populationType),
    "1",
  );
  const cullingRows = useManagedPopulationJobRows(
    toInitialCullingRows(populationType),
    "10",
  );

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;
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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    form.clearFieldErrors();

    if (hasJobError) return;

    const updateInput: UpdateManagedPopulationTypeInput = {
      cullingJobs: cullingRows.rows.map((row) => ({
        jobId: row.jobId,
        maxCullPerWorker:
          row.rateValue !== "" ? parseInt(row.rateValue, 10) : 0,
      })),
      cullingOutputsJson: [...resourceEntriesToDtoArray(form.cullingOutputs)],
      growthRate: form.growthRate,
      husbandryJobs: husbandryRows.rows.map((row) => ({
        jobId: row.jobId,
        workersPerNAnimals:
          row.rateValue !== "" ? parseInt(row.rateValue, 10) : 0,
      })),
      icon: form.icon,
      iconColor: form.iconColor,
      maintenanceRulesJson: [
        ...resourceEntriesToDtoArray(form.maintenanceRules),
      ],
      managedPopulationTypeId: populationType.id,
      name: form.name,
      regularOutputsJson: [...resourceEntriesToDtoArray(form.regularOutputs)],
      slug: form.slug,
      worldId,
    };

    const result =
      updateManagedPopulationTypeInputSchema.safeParse(updateInput);
    if (!result.success) {
      form.setFromZod(result.error);
      return;
    }

    try {
      await updateMutation.mutateAsync(updateInput);
      notifyMutationSuccess("Managed population type saved.");
      onClose();
    } catch (error) {
      handleCrudError(error, "Failed to save managed population type.");
    }
  }

  async function handleTrash(): Promise<void> {
    try {
      await softDeleteMutation.mutateAsync({
        managedPopulationTypeId: populationType.id,
        worldId,
      });
      notifyMutationSuccess("Managed population type moved to trash.");
      onClose();
    } catch (error) {
      handleCrudError(
        error,
        "Failed to move managed population type to trash.",
      );
    }
  }

  const resources = resourcesQuery.data ?? [];

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <form
          aria-label="Edit managed population type"
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit managed population type</DialogTitle>
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
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                void handleTrash();
              }}
            >
              <Trash2 aria-hidden="true" />
              Move to trash
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || hasJobError}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
