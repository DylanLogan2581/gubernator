import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useMemo, useState, type JSX } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { cultureReligionInputLimits } from "@/lib/inputLimits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { updateReligionMutationOptions } from "../../mutations/religionsMutations";
import {
  updateReligionInputSchema,
  type UpdateReligionInput,
} from "../../schemas/religionSchemas";
import {
  RELIGION_LORE_FIELD_KEYS,
  type Religion,
  type ReligionLoreFieldKey,
} from "../../types/religionTypes";

import { RELIGION_LORE_SECTIONS } from "./ReligionLoreSections";

type ReligionLoreValues = Record<ReligionLoreFieldKey, string>;

function valuesFromReligion(religion: Religion): ReligionLoreValues {
  return Object.fromEntries(
    RELIGION_LORE_FIELD_KEYS.map((key) => [key, religion[key] ?? ""]),
  ) as ReligionLoreValues;
}

export function ReligionLoreForm({
  canEdit,
  queryClient,
  religion,
}: {
  readonly canEdit: boolean;
  readonly queryClient: QueryClient;
  readonly religion: Religion;
}): JSX.Element {
  const initialValues = useMemo(() => valuesFromReligion(religion), [religion]);
  const [values, setValues] = useState<ReligionLoreValues>(initialValues);

  const isDirty = RELIGION_LORE_FIELD_KEYS.some(
    (key) => values[key] !== initialValues[key],
  );
  const unsavedChangesDialog = useUnsavedChangesGuard(isDirty && canEdit);

  const updateMutation = useMutation(
    updateReligionMutationOptions({ queryClient }),
  );

  async function handleSave(): Promise<void> {
    const changedEntries = RELIGION_LORE_FIELD_KEYS.filter(
      (key) => values[key] !== initialValues[key],
    );

    if (changedEntries.length === 0) {
      return;
    }

    const input: UpdateReligionInput = {
      religionId: religion.id,
      worldId: religion.worldId,
      ...Object.fromEntries(changedEntries.map((key) => [key, values[key]])),
    };

    const result = updateReligionInputSchema.safeParse(input);
    if (!result.success) {
      notifyMutationError(result.error, "Failed to save lore.");
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Religion lore saved.");
    } catch (error) {
      notifyMutationError(error, "Failed to save lore.");
    }
  }

  const defaultOpenSections = RELIGION_LORE_SECTIONS.map(
    (section) => section.title,
  );

  return (
    <>
      <Card className="grid gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-medium">Lore</h2>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              disabled={!isDirty || updateMutation.isPending}
              onClick={() => {
                void handleSave();
              }}
            >
              <Save aria-hidden="true" />
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
        <Accordion type="multiple" defaultValue={defaultOpenSections}>
          {RELIGION_LORE_SECTIONS.map((section) => (
            <AccordionItem key={section.title} value={section.title}>
              <AccordionTrigger>{section.title}</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3">
                  {section.fields.map((field) => (
                    <div key={field.key} className="grid gap-1 text-sm">
                      <Label htmlFor={`religion-lore-${field.key}`}>
                        {field.label}
                      </Label>
                      <Textarea
                        disabled={!canEdit || updateMutation.isPending}
                        id={`religion-lore-${field.key}`}
                        maxLength={cultureReligionInputLimits.loreFieldMax}
                        value={values[field.key]}
                        onChange={(event) => {
                          const newValue = event.currentTarget.value;
                          setValues((current) => ({
                            ...current,
                            [field.key]: newValue,
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
      {unsavedChangesDialog}
    </>
  );
}
