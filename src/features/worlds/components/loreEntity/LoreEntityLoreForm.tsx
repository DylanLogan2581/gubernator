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
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { cultureReligionInputLimits } from "@/lib/inputLimits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import type { LoreEntityBase, LoreEntityDescriptor } from "./LoreEntityTypes";

type LoreValues = Record<string, string>;

function loreValuesFrom(
  entity: LoreEntityBase,
  loreFieldKeys: readonly string[],
): LoreValues {
  const record = entity as unknown as Record<string, string | null>;
  return Object.fromEntries(
    loreFieldKeys.map((key) => [key, record[key] ?? ""]),
  );
}

type LoreEntityLoreFormProps<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
> = {
  readonly canEdit: boolean;
  readonly descriptor: LoreEntityDescriptor<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TDeleteInput,
    TMutationError
  >;
  readonly entity: TEntity;
  readonly queryClient: QueryClient;
};

export function LoreEntityLoreForm<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
>({
  canEdit,
  descriptor,
  entity,
  queryClient,
}: LoreEntityLoreFormProps<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError
>): JSX.Element {
  const { labels, loreFieldKeys, loreSections } = descriptor;

  const initialValues = useMemo(
    () => loreValuesFrom(entity, loreFieldKeys),
    [entity, loreFieldKeys],
  );
  const [values, setValues] = useState<LoreValues>(initialValues);

  const isDirty = loreFieldKeys.some(
    (key) => values[key] !== initialValues[key],
  );
  const unsavedChangesDialog = useUnsavedChangesGuard(isDirty && canEdit);

  const updateMutation = useMutation(
    descriptor.mutations.update({ queryClient }),
  );

  async function handleSave(): Promise<void> {
    const changedKeys = loreFieldKeys.filter(
      (key) => values[key] !== initialValues[key],
    );

    if (changedKeys.length === 0) {
      return;
    }

    const input = descriptor.buildUpdateInput({
      id: entity.id,
      patch: Object.fromEntries(changedKeys.map((key) => [key, values[key]])),
      worldId: entity.worldId,
    });

    const result = descriptor.updateInputSchema.safeParse(input);
    if (!result.success) {
      notifyMutationError(result.error, "Failed to save lore.");
      return;
    }

    try {
      await updateMutation.mutateAsync(input);
      notifyMutationSuccess(`${labels.singularCapital} lore saved.`);
    } catch (error) {
      notifyMutationError(error, "Failed to save lore.");
    }
  }

  const defaultOpenSections = loreSections.map((section) => section.title);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Lore</CardTitle>
          {canEdit ? (
            <CardAction>
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
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3">
          <Accordion type="multiple" defaultValue={defaultOpenSections}>
            {loreSections.map((section) => (
              <AccordionItem key={section.title} value={section.title}>
                <AccordionTrigger>{section.title}</AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-3">
                    {section.fields.map((field) => (
                      <div key={field.key} className="grid gap-1 text-sm">
                        <Label htmlFor={`${labels.singular}-lore-${field.key}`}>
                          {field.label}
                        </Label>
                        <Textarea
                          disabled={!canEdit || updateMutation.isPending}
                          id={`${labels.singular}-lore-${field.key}`}
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
        </CardContent>
      </Card>
      {unsavedChangesDialog}
    </>
  );
}
