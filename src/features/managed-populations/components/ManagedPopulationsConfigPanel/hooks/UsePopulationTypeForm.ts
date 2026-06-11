import { useState } from "react";

import type { ResourceAmountEntry } from "@/components/shared/ResourceAmountListEditor";
import { managedPopulationInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import type { ManagedPopulationType } from "../../../types/managedPopulationTypes";
import type { ZodError } from "zod";

export type ManagedPopulationTypeFieldErrors = {
  readonly cullingJobId?: string;
  readonly growthRate?: string;
  readonly husbandryJobId?: string;
  readonly husbandryWorkersPerNAnimals?: string;
  readonly name?: string;
  readonly slug?: string;
};

type UsePopulationTypeFormReturn = {
  readonly name: string;
  readonly slug: string;
  readonly husbandryJobId: string;
  readonly cullingJobId: string;
  readonly husbandryWorkersPerNAnimals: string;
  readonly growthRate: number;
  readonly maintenanceRules: ResourceAmountEntry[];
  readonly cullingOutputs: ResourceAmountEntry[];
  readonly regularOutputs: ResourceAmountEntry[];
  readonly fieldErrors: ManagedPopulationTypeFieldErrors;
  readonly husbandryJobLinkError: string | undefined;
  readonly cullingJobLinkError: string | undefined;
  readonly jobCollisionError: string | undefined;
  readonly hasJobError: boolean;
  readonly setName: (value: string) => void;
  readonly setSlug: (value: string) => void;
  readonly setHusbandryJobId: (value: string) => void;
  readonly setCullingJobId: (value: string) => void;
  readonly setHusbandryWorkersPerNAnimals: (value: string) => void;
  readonly setGrowthRate: (value: number) => void;
  readonly setMaintenanceRules: (value: ResourceAmountEntry[]) => void;
  readonly setCullingOutputs: (value: ResourceAmountEntry[]) => void;
  readonly setRegularOutputs: (value: ResourceAmountEntry[]) => void;
  readonly setFieldErrors: (value: ManagedPopulationTypeFieldErrors) => void;
  readonly clearFieldErrors: () => void;
  readonly setFromZod: (error: ZodError) => void;
  readonly handleNameChange: (value: string) => void;
  readonly handleHusbandryJobChange: (selectedId: string) => void;
  readonly handleCullingJobChange: (selectedId: string) => void;
};

type UsePopulationTypeFormOptions = {
  readonly allPopulationTypes: readonly ManagedPopulationType[];
  readonly initialName?: string;
  readonly initialSlug?: string;
  readonly initialHusbandryJobId?: string;
  readonly initialCullingJobId?: string;
  readonly initialHusbandryWorkersPerNAnimals?: string;
  readonly initialGrowthRate?: number;
  readonly initialMaintenanceRules?: ResourceAmountEntry[];
  readonly initialCullingOutputs?: ResourceAmountEntry[];
  readonly initialRegularOutputs?: ResourceAmountEntry[];
  readonly editingPopulationTypeId?: string;
};

export function usePopulationTypeForm({
  allPopulationTypes,
  initialName = "",
  initialSlug = "",
  initialHusbandryJobId = "",
  initialCullingJobId = "",
  initialHusbandryWorkersPerNAnimals = "1",
  initialGrowthRate = 0,
  initialMaintenanceRules = [],
  initialCullingOutputs = [],
  initialRegularOutputs = [],
  editingPopulationTypeId,
}: UsePopulationTypeFormOptions): UsePopulationTypeFormReturn {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [husbandryJobId, setHusbandryJobId] = useState(initialHusbandryJobId);
  const [cullingJobId, setCullingJobId] = useState(initialCullingJobId);
  const [husbandryWorkersPerNAnimals, setHusbandryWorkersPerNAnimals] =
    useState(initialHusbandryWorkersPerNAnimals);
  const [growthRate, setGrowthRate] = useState(initialGrowthRate);
  const [maintenanceRules, setMaintenanceRules] = useState<
    ResourceAmountEntry[]
  >(initialMaintenanceRules);
  const [cullingOutputs, setCullingOutputs] = useState<ResourceAmountEntry[]>(
    initialCullingOutputs,
  );
  const [regularOutputs, setRegularOutputs] = useState<ResourceAmountEntry[]>(
    initialRegularOutputs,
  );
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof ManagedPopulationTypeFieldErrors>();
  const setFieldErrors = (_value: ManagedPopulationTypeFieldErrors): void => {
    // Bridge method - fieldErrors now managed by useFieldErrors hook via setFromZod
  };
  const [husbandryJobLinkError, setHusbandryJobLinkError] = useState<
    string | undefined
  >(undefined);
  const [cullingJobLinkError, setCullingJobLinkError] = useState<
    string | undefined
  >(undefined);

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(
      toSlug(value, {
        maxLength: managedPopulationInputLimits.populationTypeSlugMax,
      }),
    );
  }

  function handleHusbandryJobChange(selectedId: string): void {
    setHusbandryJobId(selectedId);
    const conflict = allPopulationTypes.find(
      (pt) =>
        pt.husbandryJobId === selectedId &&
        selectedId !== "" &&
        (editingPopulationTypeId === undefined ||
          pt.id !== editingPopulationTypeId),
    );
    setHusbandryJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  function handleCullingJobChange(selectedId: string): void {
    setCullingJobId(selectedId);
    const conflict = allPopulationTypes.find(
      (pt) =>
        pt.cullingJobId === selectedId &&
        selectedId !== "" &&
        (editingPopulationTypeId === undefined ||
          pt.id !== editingPopulationTypeId),
    );
    setCullingJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  const jobCollisionError =
    husbandryJobId !== "" &&
    cullingJobId !== "" &&
    husbandryJobId === cullingJobId
      ? "Husbandry job and culling job must be different."
      : undefined;

  const hasJobError =
    husbandryJobLinkError !== undefined ||
    cullingJobLinkError !== undefined ||
    jobCollisionError !== undefined;

  return {
    // State
    name,
    slug,
    husbandryJobId,
    cullingJobId,
    husbandryWorkersPerNAnimals,
    growthRate,
    maintenanceRules,
    cullingOutputs,
    regularOutputs,
    fieldErrors,
    husbandryJobLinkError,
    cullingJobLinkError,
    jobCollisionError,
    hasJobError,
    // Setters
    setName,
    setSlug,
    setHusbandryJobId,
    setCullingJobId,
    setHusbandryWorkersPerNAnimals,
    setGrowthRate,
    setMaintenanceRules,
    setCullingOutputs,
    setRegularOutputs,
    setFieldErrors,
    clearFieldErrors: clear,
    setFromZod,
    // Handlers
    handleNameChange,
    handleHusbandryJobChange,
    handleCullingJobChange,
  };
}
