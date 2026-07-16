import { useState } from "react";

import type { ResourceAmountEntry } from "@/components/shared/ResourceAmountListEditor";
import type { CategoricalSlot } from "@/lib/categoricalPalette";
import { managedPopulationInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import type { ZodError } from "zod";

export type ManagedPopulationTypeFieldErrors = {
  readonly cullingJobs?: string;
  readonly growthRate?: string;
  readonly husbandryJobs?: string;
  readonly name?: string;
  readonly slug?: string;
};

type UsePopulationTypeFormReturn = {
  readonly name: string;
  readonly slug: string;
  readonly growthRate: number;
  readonly icon: string | null;
  readonly iconColor: CategoricalSlot | null;
  readonly maintenanceRules: ResourceAmountEntry[];
  readonly cullingOutputs: ResourceAmountEntry[];
  readonly regularOutputs: ResourceAmountEntry[];
  readonly fieldErrors: ManagedPopulationTypeFieldErrors;
  readonly setName: (value: string) => void;
  readonly setSlug: (value: string) => void;
  readonly setGrowthRate: (value: number) => void;
  readonly setIcon: (value: string | null) => void;
  readonly setIconColor: (value: CategoricalSlot | null) => void;
  readonly setMaintenanceRules: (value: ResourceAmountEntry[]) => void;
  readonly setCullingOutputs: (value: ResourceAmountEntry[]) => void;
  readonly setRegularOutputs: (value: ResourceAmountEntry[]) => void;
  readonly clearFieldErrors: () => void;
  readonly setFromZod: (error: ZodError) => void;
  readonly handleNameChange: (value: string) => void;
};

type UsePopulationTypeFormOptions = {
  readonly initialName?: string;
  readonly initialSlug?: string;
  readonly initialGrowthRate?: number;
  readonly initialIcon?: string | null;
  readonly initialIconColor?: CategoricalSlot | null;
  readonly initialMaintenanceRules?: ResourceAmountEntry[];
  readonly initialCullingOutputs?: ResourceAmountEntry[];
  readonly initialRegularOutputs?: ResourceAmountEntry[];
};

export function usePopulationTypeForm({
  initialName = "",
  initialSlug = "",
  initialGrowthRate = 0,
  initialIcon = null,
  initialIconColor = null,
  initialMaintenanceRules = [],
  initialCullingOutputs = [],
  initialRegularOutputs = [],
}: UsePopulationTypeFormOptions): UsePopulationTypeFormReturn {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [growthRate, setGrowthRate] = useState(initialGrowthRate);
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [iconColor, setIconColor] = useState<CategoricalSlot | null>(
    initialIconColor,
  );
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

  function handleNameChange(value: string): void {
    setName(value);
    setSlug(
      toSlug(value, {
        maxLength: managedPopulationInputLimits.populationTypeSlugMax,
      }),
    );
  }

  return {
    // State
    name,
    slug,
    growthRate,
    icon,
    iconColor,
    maintenanceRules,
    cullingOutputs,
    regularOutputs,
    fieldErrors,
    // Setters
    setName,
    setSlug,
    setGrowthRate,
    setIcon,
    setIconColor,
    setMaintenanceRules,
    setCullingOutputs,
    setRegularOutputs,
    clearFieldErrors: clear,
    setFromZod,
    // Handlers
    handleNameChange,
  };
}
