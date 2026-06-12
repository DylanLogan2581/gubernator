import { Plus, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EventEffectType =
  | "building_damage"
  | "consumption_multiplier"
  | "deposit_discovered"
  | "managed_population_change"
  | "population_boost"
  | "population_loss"
  | "production_multiplier"
  | "resource_drain"
  | "resource_grant"
  | "upkeep_multiplier";

type EffectData = {
  effectType: string;
  isPercent: boolean;
  amountValue: number | null;
  multiplierValue: number | null;
  resourceId: string | null;
  jobId: number | null;
  managedPopulationInstanceId: string | null;
  depositInstanceId: string | null;
  _id?: string;
};

type EventCreateEffectsStepProps = {
  readonly effects: EffectData[];
  readonly onEffectsChange: (effects: EffectData[]) => void;
};

const EFFECT_TYPE_OPTIONS: Array<{
  value: EventEffectType;
  label: string;
  description: string;
}> = [
  {
    value: "resource_grant",
    label: "Grant Resource",
    description: "Add resources to a settlement",
  },
  {
    value: "resource_drain",
    label: "Drain Resource",
    description: "Remove resources from a settlement",
  },
  {
    value: "population_loss",
    label: "Population Loss",
    description: "Reduce population (optionally by job type)",
  },
  {
    value: "population_boost",
    label: "Population Boost",
    description: "Increase population",
  },
  {
    value: "managed_population_change",
    label: "Managed Population Change",
    description: "Adjust managed population (animals, etc.)",
  },
  {
    value: "production_multiplier",
    label: "Production Multiplier",
    description: "Modify production rates",
  },
  {
    value: "consumption_multiplier",
    label: "Consumption Multiplier",
    description: "Modify resource consumption rates",
  },
  {
    value: "upkeep_multiplier",
    label: "Upkeep Multiplier",
    description: "Modify building upkeep rates",
  },
  {
    value: "building_damage",
    label: "Building Damage",
    description: "Damage buildings",
  },
  {
    value: "deposit_discovered",
    label: "Deposit Discovered",
    description: "Discover new deposits",
  },
];

function EffectEditor({
  effect,
  onUpdate,
  onRemove,
}: {
  readonly effect: EffectData;
  readonly onUpdate: (updated: EffectData) => void;
  readonly onRemove: () => void;
}): JSX.Element {
  const effectTypeOption = EFFECT_TYPE_OPTIONS.find(
    (opt) => opt.value === effect.effectType,
  );

  const isAmountEffect = [
    "resource_grant",
    "resource_drain",
    "population_loss",
    "population_boost",
    "managed_population_change",
  ].includes(effect.effectType);

  const isMultiplierEffect = [
    "production_multiplier",
    "consumption_multiplier",
    "upkeep_multiplier",
  ].includes(effect.effectType);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">
              {effectTypeOption?.label}
            </CardTitle>
            <CardDescription>{effectTypeOption?.description}</CardDescription>
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
        {isAmountEffect && (
          <>
            <div className="space-y-2">
              <Label>Mode</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!effect.isPercent}
                    onChange={() => onUpdate({ ...effect, isPercent: false })}
                  />
                  <span className="text-sm">Flat amount</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={effect.isPercent}
                    onChange={() => onUpdate({ ...effect, isPercent: true })}
                  />
                  <span className="text-sm">Percent of current</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`amount-${effect.effectType}`}>
                {effect.isPercent ? "Percent" : "Amount"}
              </Label>
              <Input
                id={`amount-${effect.effectType}`}
                type="number"
                placeholder={
                  effect.isPercent ? "e.g., 10 for 10%" : "e.g., 100"
                }
                value={effect.amountValue ?? ""}
                onChange={(e) =>
                  onUpdate({
                    ...effect,
                    amountValue:
                      e.target.value !== "" ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>
          </>
        )}

        {isMultiplierEffect && (
          <div className="space-y-2">
            <Label htmlFor={`multiplier-${effect.effectType}`}>
              Multiplier (e.g., 1.2 for 20% increase, 0.8 for 20% decrease)
            </Label>
            <Input
              id={`multiplier-${effect.effectType}`}
              type="number"
              placeholder="1.0"
              step="0.1"
              value={effect.multiplierValue ?? ""}
              onChange={(e) =>
                onUpdate({
                  ...effect,
                  multiplierValue:
                    e.target.value !== "" ? parseFloat(e.target.value) : null,
                })
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EventCreateEffectsStep({
  effects,
  onEffectsChange,
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
      managedPopulationInstanceId: null,
      depositInstanceId: null,
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
                  {opt.label} — {opt.description}
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
                onUpdate={(updated) => updateEffect(idx, updated)}
                onRemove={() => removeEffect(idx)}
              />
            ))}
          </div>
        </div>
      )}

      {effects.length === 0 && (
        <div className="rounded-lg border border-dashed border-muted-foreground p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No effects configured yet. Add at least one effect above to
            continue.
          </p>
        </div>
      )}
    </div>
  );
}
