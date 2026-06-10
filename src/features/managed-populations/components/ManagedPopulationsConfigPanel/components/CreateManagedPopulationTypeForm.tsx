import { useQuery } from "@tanstack/react-query";
import { type FormEvent, type JSX } from "react";

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
// eslint-disable-next-line import-x/no-internal-modules
import { createManagedPopulationTypeInputSchema } from "@/features/managed-populations/schemas/managedPopulationSchemas";
// eslint-disable-next-line import-x/no-internal-modules
import type { CreateManagedPopulationTypeInput } from "@/features/managed-populations/schemas/managedPopulationSchemas";
// eslint-disable-next-line import-x/no-internal-modules
import type { ManagedPopulationType } from "@/features/managed-populations/types/managedPopulationTypes";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";

import { usePopulationTypeForm } from "../hooks/UsePopulationTypeForm";
import { resourceEntriesToDtoArray } from "../utils/PopulationTypeFormMapping";

import { PopulationTypeScalarFields } from "./PopulationTypeScalarFields";

export function CreateManagedPopulationTypeForm({
  allPopulationTypes,
  cullingJobs,
  husbandryJobs,
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly allPopulationTypes: readonly ManagedPopulationType[];
  readonly cullingJobs: readonly JobDefinition[];
  readonly husbandryJobs: readonly JobDefinition[];
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateManagedPopulationTypeInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const form = usePopulationTypeForm({
    allPopulationTypes,
    initialName: "",
    initialSlug: "",
    initialHusbandryJobId: "",
    initialCullingJobId: "",
    initialHusbandryWorkersPerNAnimals: "1",
    initialGrowthRate: 0,
    initialMaintenanceRules: [],
    initialCullingOutputs: [],
    initialRegularOutputs: [],
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    form.clearFieldErrors();

    if (form.hasJobError) return;

    const input: CreateManagedPopulationTypeInput = {
      cullingJobId: form.cullingJobId,
      cullingOutputsJson:
        form.cullingOutputs.length > 0
          ? [...resourceEntriesToDtoArray(form.cullingOutputs)]
          : undefined,
      growthRate: form.growthRate,
      husbandryJobId: form.husbandryJobId,
      husbandryWorkersPerNAnimals:
        form.husbandryWorkersPerNAnimals !== ""
          ? parseInt(form.husbandryWorkersPerNAnimals, 10)
          : 0,
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
            <DialogDescription className="sr-only">
              Define a managed population type and its resource behavior.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isPending || form.hasJobError} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
