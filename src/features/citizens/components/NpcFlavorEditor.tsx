import { Save, Wand2, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type NpcFlavor } from "../utils/npcFlavor";

type NpcFlavorEditorProps = {
  readonly disabled?: boolean;
  readonly initial: NpcFlavor;
  readonly onCancel?: () => void;
  readonly onGenerate?: () => NpcFlavor;
  readonly onSave: (next: NpcFlavor) => void;
  readonly submitLabel?: string;
};

export function NpcFlavorEditor({
  disabled = false,
  initial,
  onCancel,
  onGenerate,
  onSave,
  submitLabel = "Save flavor",
}: NpcFlavorEditorProps): JSX.Element {
  const [trait1, setTrait1] = useState(initial.trait1);
  const [trait2, setTrait2] = useState(initial.trait2);
  const [contradiction, setContradiction] = useState(initial.contradiction);
  const [goal, setGoal] = useState(initial.goal);
  const [flaw, setFlaw] = useState(initial.flaw);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSave({ contradiction, flaw, goal, trait1, trait2 });
  }

  return (
    <form
      aria-label="Edit NPC flavor"
      className="grid gap-3 p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-medium">NPC flavor</h3>
        {onCancel === undefined ? null : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Cancel edit"
            onClick={onCancel}
            disabled={disabled}
          >
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FlavorInputField
          disabled={disabled}
          label="Trait 1"
          onChange={setTrait1}
          value={trait1}
        />
        <FlavorInputField
          disabled={disabled}
          label="Trait 2"
          onChange={setTrait2}
          value={trait2}
        />
      </div>
      <FlavorTextField
        disabled={disabled}
        label="Secret / contradiction"
        onChange={setContradiction}
        value={contradiction}
      />
      <FlavorTextField
        disabled={disabled}
        label="Goal"
        onChange={setGoal}
        value={goal}
      />
      <FlavorTextField
        disabled={disabled}
        label="Flaw"
        onChange={setFlaw}
        value={flaw}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={disabled}>
          <Save aria-hidden="true" />
          {submitLabel}
        </Button>
        {onGenerate !== undefined ? (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              const flavor = onGenerate();
              setTrait1(flavor.trait1);
              setTrait2(flavor.trait2);
              setContradiction(flavor.contradiction);
              setGoal(flavor.goal);
              setFlaw(flavor.flaw);
            }}
          >
            <Wand2 aria-hidden="true" />
            Generate
          </Button>
        ) : null}
        {onCancel === undefined ? null : (
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function FlavorInputField({
  disabled,
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <Label htmlFor="flavor-input">{label}</Label>
      <Input
        id="flavor-input"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

function FlavorTextField({
  disabled,
  label,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <Label htmlFor="flavor-text">{label}</Label>
      <textarea
        id="flavor-text"
        className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}
