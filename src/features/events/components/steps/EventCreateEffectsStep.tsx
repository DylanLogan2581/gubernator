import { Plus, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateLocalId } from "@/lib/uid";

import { EFFECT_EDITORS } from "./effect-editors";

import type { EffectData, EventEffectType } from "./effect-editors";

type EventCreateEffectsStepProps = {
  readonly effects: EffectData[];
  readonly onEffectsChange: (effects: EffectData[]) => void;
  readonly worldId: string;
  readonly selectedIds: string[];
  readonly scopeType: "world" | "nation" | "settlement" | null;
};

// Multiplier effect types and their targets:
// - production_multiplier: job output (optionally scoped by job or building)
// - consumption_multiplier: citizen food/water consumption
// - upkeep_multiplier: building upkeep costs only (managed populations have no upkeep)
// Note: managed population upkeep multiplier not added because managed populations
// (animals, etc.) do not incur upkeep costs in the simulation.
const EFFECT_TYPE_OPTIONS: Array<{
  value: EventEffectType;
  label: string;
  description: string;
}> = [
  {
    value: "modify_resource",
    label: "Modify Resource",
    description:
      "Add or remove resources (positive for grant, negative for drain)",
  },
  {
    value: "population_loss",
    label: "Population Loss",
    description:
      "Kill a number of citizens (flat count or percent of living population)",
  },
  {
    value: "population_boost",
    label: "Population Gain",
    description:
      "Add citizens to targeted settlements each turn the event is active",
  },
  {
    value: "managed_population_change",
    label: "Managed Population Change",
    description: "Adjust managed population (animals, etc.)",
  },
  {
    value: "production_multiplier",
    label: "Job Production Multiplier",
    description:
      "Multiply job output production (optionally scoped by job or building)",
  },
  {
    value: "consumption_multiplier",
    label: "Citizen Consumption Multiplier",
    description: "Multiply citizen food and water consumption",
  },
  {
    value: "upkeep_multiplier",
    label: "Building Upkeep Multiplier",
    description: "Multiply building upkeep costs",
  },
  {
    value: "building_destroyed",
    label: "Building Destroyed",
    description: "Destroy specific buildings",
  },
  {
    value: "deposit_destroyed",
    label: "Deposit Destroyed",
    description: "Destroy existing deposits",
  },
];

// Reference map for all effect types (for editing existing effects)
const ALL_EFFECT_TYPES: Record<string, { label: string; description: string }> =
  {
    resource_grant: {
      label: "Modify Resource",
      description: "Add or remove resources",
    },
    resource_drain: {
      label: "Modify Resource",
      description: "Add or remove resources",
    },
    population_boost: {
      label: "Modify Population",
      description: "Increase or decrease population",
    },
    population_loss: {
      label: "Population Loss",
      description: "Kill a number of citizens",
    },
    ...Object.fromEntries(
      EFFECT_TYPE_OPTIONS.map((opt) => [
        opt.value,
        { label: opt.label, description: opt.description },
      ]),
    ),
  };

// Resolve the card title for an effect, covering the legacy aliases that are
// not present in EFFECT_TYPE_OPTIONS.
function resolveEffectLabel(effectType: string): string {
  const option = EFFECT_TYPE_OPTIONS.find((opt) => opt.value === effectType);
  if (option !== undefined) return option.label;
  if (
    effectType === "modify_resource" ||
    effectType === "resource_grant" ||
    effectType === "resource_drain"
  ) {
    return "Modify Resource";
  }
  if (effectType === "population_boost" || effectType === "population_loss") {
    return "Modify Population";
  }
  return ALL_EFFECT_TYPES[effectType]?.label ?? "";
}

function EffectEditor({
  effect,
  index,
  onUpdate,
  onRemove,
  worldId,
  selectedIds,
  scopeType,
}: {
  readonly effect: EffectData;
  readonly index: number;
  readonly onUpdate: (updated: EffectData) => void;
  readonly onRemove: () => void;
  readonly worldId: string;
  readonly selectedIds: string[];
  readonly scopeType: "world" | "nation" | "settlement" | null;
}): JSX.Element {
  const Editor = EFFECT_EDITORS[effect.effectType];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">
              {resolveEffectLabel(effect.effectType)}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {Editor !== undefined && (
          <Editor
            effect={effect}
            index={index}
            onUpdate={onUpdate}
            worldId={worldId}
            selectedIds={selectedIds}
            scopeType={scopeType}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function EventCreateEffectsStep({
  effects,
  onEffectsChange,
  worldId,
  selectedIds,
  scopeType,
}: EventCreateEffectsStepProps): JSX.Element {
  const [selectedType, setSelectedType] = useState<EventEffectType | "">("");

  const addEffect = (): void => {
    if (selectedType === "") return;
    const newEffect: EffectData = {
      effectType: selectedType,
      isPercent: false,
      amountValue: null,
      multiplierValue: null,
      resourceId: null,
      jobId: null,
      jobMode: undefined,
      managedPopulationInstanceId: null,
      managedPopulationTypeId: null,
      managedPopulationMode: undefined,
      depositInstanceId: null,
      depositInstanceIds: undefined,
      depositTypeId: null,
      depositDestroyedMode: undefined,
      settlementBuildingId: null,
      buildingBlueprintMode: undefined,
      buildingInstanceIds: undefined,
      _id: generateLocalId(),
    };
    onEffectsChange([...effects, newEffect]);
    setSelectedType("");
  };

  const updateEffect = (index: number, updated: EffectData): void => {
    const newEffects = [...effects];
    newEffects[index] = updated;
    onEffectsChange(newEffects);
  };

  const removeEffect = (index: number): void => {
    onEffectsChange(effects.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="effect-type-select" className="text-base font-semibold">
          Add Effect
        </Label>
        <div className="flex gap-2">
          <Select
            value={selectedType}
            onValueChange={(v) => setSelectedType(v as EventEffectType)}
          >
            <SelectTrigger id="effect-type-select" className="flex-1">
              <SelectValue placeholder="Select an effect type..." />
            </SelectTrigger>
            <SelectContent>
              {EFFECT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addEffect} disabled={selectedType === ""}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {effects.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {effects.length} effect{effects.length === 1 ? "" : "s"} configured
          </p>
          <div className="space-y-3">
            {effects.map((effect, idx) => (
              <EffectEditor
                key={effect._id ?? idx}
                effect={effect}
                index={idx}
                onUpdate={(updated) => updateEffect(idx, updated)}
                onRemove={() => removeEffect(idx)}
                worldId={worldId}
                selectedIds={selectedIds}
                scopeType={scopeType}
              />
            ))}
          </div>
        </div>
      )}

      {effects.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No effects configured yet. Add effects to customize the event, or
          leave empty for a narrative-only event.
        </p>
      )}
    </div>
  );
}
