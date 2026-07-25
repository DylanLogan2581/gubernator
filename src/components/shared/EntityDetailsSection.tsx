import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Values submitted from the edit form; description is null when left blank. */
export type EntityDetailsValues = {
  readonly name: string;
  readonly description: string | null;
};

/**
 * View/edit "Details" section (name + description) shared by the nation and
 * settlement detail pages. Owns the view/edit toggle, form state and
 * validation; the owning feature supplies the persistence via `onSave` and
 * keeps the section behaviour identical across entities.
 */
export function EntityDetailsSection({
  canEdit,
  descriptionMaxLength,
  entityLabel,
  idPrefix,
  initialDescription,
  initialName,
  isSaving,
  nameMaxLength,
  onSave,
  resetMutation,
}: {
  readonly canEdit: boolean;
  readonly descriptionMaxLength: number;
  /** Human label, e.g. "Nation" — used in aria labels and the required error. */
  readonly entityLabel: string;
  /** Prefix for the section's a11y ids, e.g. "nation" or "settlement". */
  readonly idPrefix: string;
  readonly initialDescription: string | null;
  readonly initialName: string;
  readonly isSaving: boolean;
  readonly nameMaxLength: number;
  readonly onSave: (
    values: EntityDetailsValues,
    callbacks: { readonly onSuccess: () => void },
  ) => void;
  /** Clears any pending mutation error state when the form is reset. */
  readonly resetMutation?: () => void;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const headingId = `${idPrefix}-details-heading`;
  const nameId = `${idPrefix}-detail-name`;
  const nameErrorId = `${idPrefix}-detail-name-error`;
  const descId = `${idPrefix}-detail-desc`;

  function resetForm(): void {
    setName(initialName);
    setDescription(initialDescription ?? "");
    setNameError(undefined);
    resetMutation?.();
  }

  function closeEditor(): void {
    setIsEditing(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    resetMutation?.();

    if (name.trim().length === 0) {
      setNameError(`${entityLabel} name is required.`);
      return;
    }

    onSave(
      {
        description: description.trim().length === 0 ? null : description,
        name,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  }

  if (!isEditing) {
    return (
      <section aria-labelledby={headingId} className="grid gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id={headingId} className="text-base font-medium">
            Details
          </h2>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </div>
        {initialDescription === null ? (
          <p className="text-sm italic text-muted-foreground">
            No description.
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {initialDescription}
          </p>
        )}
      </section>
    );
  }

  return (
    <form
      aria-label={`Edit ${entityLabel.toLowerCase()} details`}
      className="grid gap-3 p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Edit details</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeEditor}
          aria-label="Cancel edit"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <Label className="grid gap-1 text-sm" htmlFor={nameId}>
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={nameError === undefined ? undefined : true}
          aria-describedby={nameError === undefined ? undefined : nameErrorId}
          disabled={isSaving}
          id={nameId}
          maxLength={nameMaxLength}
          required
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
            if (nameError !== undefined) {
              setNameError(undefined);
            }
          }}
        />
        {nameError === undefined ? null : (
          <p id={nameErrorId} role="alert" className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </Label>
      <Label className="grid gap-1 text-sm" htmlFor={descId}>
        <span className="text-muted-foreground">Description</span>
        <textarea
          className="min-h-[6rem] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={isSaving}
          aria-label="Description"
          id={descId}
          maxLength={descriptionMaxLength}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </Label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSaving}>
          <Save aria-hidden="true" />
          {isSaving ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={closeEditor}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
