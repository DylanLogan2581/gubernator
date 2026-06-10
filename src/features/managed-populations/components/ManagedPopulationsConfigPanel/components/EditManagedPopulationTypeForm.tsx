import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { type FormEvent, type JSX } from "react";

import {
  handleCrudError,
} from "@/components/shared/ConfigCrudPanel";
import {
  ResourceAmountListEditor,
} from "@/components/shared/ResourceAmountListEditor";
import { Button } from "@/components/ui/button";
import type { JobDefinition } from "@/features/jobs";
// eslint-disable-next-line import-x/no-internal-modules
import {
  softDeleteManagedPopulationTypeMutationOptions,
  updateManagedPopulationTypeMutationOptions,
} from "@/features/managed-populations/mutations/managedPopulationsMutations";
// eslint-disable-next-line import-x/no-internal-modules
import {
  updateManagedPopulationTypeInputSchema,
} from "@/features/managed-populations/schemas/managedPopulationSchemas";
// eslint-disable-next-line import-x/no-internal-modules
import type {
  UpdateManagedPopulationTypeInput,
} from "@/features/managed-populations/schemas/managedPopulationSchemas";
// eslint-disable-next-line import-x/no-internal-modules
import type { ManagedPopulationType } from "@/features/managed-populations/types/managedPopulationTypes";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { notifyMutationSuccess } from "@/lib/notify";

import { usePopulationTypeForm } from "../hooks/UsePopulationTypeForm";
import {
  databaseResourcesToEntries,
  resourceEntriesToDtoArray,
} from "../utils/PopulationTypeFormMapping";

import { PopulationTypeScalarFields } from "./PopulationTypeScalarFields";

export function EditManagedPopulationTypeForm({
  allPopulationTypes,
  cullingJobs,
  husbandryJobs,
  populationType,
  onClose,
  queryClient,
  worldId,
}: {
  readonly allPopulationTypes: readonly ManagedPopulationType[];
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
    allPopulationTypes,
    initialName: populationType.name,
    initialSlug: populationType.slug,
    initialHusbandryJobId: populationType.husbandryJobId,
    initialCullingJobId: populationType.cullingJobId,
    initialHusbandryWorkersPerNAnimals: String(
      populationType.husbandryWorkersPerNAnimals,
    ),
    initialGrowthRate: populationType.growthRate,
    initialMaintenanceRules: databaseResourcesToEntries(
      populationType.maintenanceRulesJson,
    ),
    initialCullingOutputs: databaseResourcesToEntries(
      populationType.cullingOutputsJson,
    ),
    initialRegularOutputs: databaseResourcesToEntries(
      populationType.regularOutputsJson,
    ),
    editingPopulationTypeId: populationType.id,
  });

  const isPending = updateMutation.isPending || softDeleteMutation.isPending;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    form.clearFieldErrors();

    if (form.hasJobError) return;

    const updateInput: UpdateManagedPopulationTypeInput = {
      cullingJobId: form.cullingJobId,
      cullingOutputsJson: [...resourceEntriesToDtoArray(form.cullingOutputs)],
      growthRate: form.growthRate,
      husbandryJobId: form.husbandryJobId,
      husbandryWorkersPerNAnimals:
        form.husbandryWorkersPerNAnimals !== ""
          ? parseInt(form.husbandryWorkersPerNAnimals, 10)
          : undefined,
      maintenanceRulesJson: [...resourceEntriesToDtoArray(form.maintenanceRules)],
      managedPopulationTypeId: populationType.id,
      name: form.name,
      regularOutputsJson: [...resourceEntriesToDtoArray(form.regularOutputs)],
      slug: form.slug,
      worldId,
    };

    const result = updateManagedPopulationTypeInputSchema.safeParse(
      updateInput,
    );
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
    <form
      aria-label="Edit managed population type"
      className="grid gap-4 rounded-md border border-border bg-background p-4"
      noValidate
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
    >
      <h3 className="text-sm font-medium">Edit managed population type</h3>
      <div className="grid gap-3">
        <PopulationTypeScalarFields
          cullingJobId={form.cullingJobId}
          cullingJobLinkError={form.cullingJobLinkError}
          cullingJobs={cullingJobs}
          fieldErrors={form.fieldErrors}
          growthRate={form.growthRate}
          husbandryJobId={form.husbandryJobId}
          husbandryJobLinkError={form.husbandryJobLinkError}
          husbandryJobs={husbandryJobs}
          husbandryWorkersPerNAnimals={form.husbandryWorkersPerNAnimals}
          isPending={isPending}
          jobCollisionError={form.jobCollisionError}
          name={form.name}
          slug={form.slug}
          worldId={worldId}
          onCullingJobChange={form.handleCullingJobChange}
          onGrowthRateChange={form.setGrowthRate}
          onHusbandryJobChange={form.handleHusbandryJobChange}
          onHusbandryWorkersPerNAnimalsChange={
            form.setHusbandryWorkersPerNAnimals
          }
          onNameChange={form.handleNameChange}
        />
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isPending || form.hasJobError}>
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
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
      </div>
    </form>
  );
}
