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

import { updateCultureMutationOptions } from "../../mutations/culturesMutations";
import {
  updateCultureInputSchema,
  type UpdateCultureInput,
} from "../../schemas/cultureSchemas";
import {
  CULTURE_LORE_FIELD_KEYS,
  type Culture,
  type CultureLoreFieldKey,
} from "../../types/cultureTypes";

import { CULTURE_LORE_SECTIONS } from "./CultureLoreSections";

type CultureLoreValues = Record<CultureLoreFieldKey, string>;

function valuesFromCulture(culture: Culture): CultureLoreValues {
  return Object.fromEntries(
    CULTURE_LORE_FIELD_KEYS.map((key) => [key, culture[key] ?? ""]),
  ) as CultureLoreValues;
}

export function CultureLoreForm({
  canEdit,
  culture,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly culture: Culture;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const initialValues = useMemo(() => valuesFromCulture(culture), [culture]);
  const [values, setValues] = useState<CultureLoreValues>(initialValues);

  const isDirty = CULTURE_LORE_FIELD_KEYS.some(
    (key) => values[key] !== initialValues[key],
  );
  const unsavedChangesDialog = useUnsavedChangesGuard(isDirty && canEdit);

  const updateMutation = useMutation(
    updateCultureMutationOptions({ queryClient }),
  );

  async function handleSave(): Promise<void> {
    const changedEntries = CULTURE_LORE_FIELD_KEYS.filter(
      (key) => values[key] !== initialValues[key],
    );

    if (changedEntries.length === 0) {
      return;
    }

    const input: UpdateCultureInput = {
      cultureId: culture.id,
      worldId: culture.worldId,
      ...Object.fromEntries(changedEntries.map((key) => [key, values[key]])),
    };

    const result = updateCultureInputSchema.safeParse(input);
    if (!result.success) {
      notifyMutationError(result.error, "Failed to save lore.");
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess("Culture lore saved.");
    } catch (error) {
      notifyMutationError(error, "Failed to save lore.");
    }
  }

  const defaultOpenSections = CULTURE_LORE_SECTIONS.map(
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
          {CULTURE_LORE_SECTIONS.map((section) => (
            <AccordionItem key={section.title} value={section.title}>
              <AccordionTrigger>{section.title}</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3">
                  {section.fields.map((field) => (
                    <div key={field.key} className="grid gap-1 text-sm">
                      <Label htmlFor={`culture-lore-${field.key}`}>
                        {field.label}
                      </Label>
                      <Textarea
                        disabled={!canEdit || updateMutation.isPending}
                        id={`culture-lore-${field.key}`}
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
