import { useState, type FormEvent, type JSX } from "react";

import { SlugHint } from "@/components/shared/SlugHint";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resourceInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createResourceInputSchema,
  type CreateResourceInput,
} from "../../schemas/resourceSchemas";

type CreateResourceFieldErrors = {
  readonly baseStockpileCap?: string;
  readonly name?: string;
  readonly slug?: string;
};

type CreateResourceFormProps = {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateResourceInput) => void;
  readonly worldId: string;
};

export function CreateResourceForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: CreateResourceFormProps): JSX.Element {
  const [name, setName] = useState("");
  const [baseStockpileCap, setBaseStockpileCap] = useState("");
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof CreateResourceFieldErrors>();

  const derivedSlug = toSlug(name, {
    maxLength: resourceInputLimits.resourceSlugMax,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const input: CreateResourceInput = {
      baseStockpileCap: baseStockpileCap !== "" ? baseStockpileCap : undefined,
      name,
      slug: derivedSlug,
      worldId,
    };

    const result = createResourceInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    onSubmit(input);
  }

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create resource</DialogTitle>
            <DialogDescription>
              Define a resource and its base stockpile settings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label
              className="grid gap-1 text-sm"
              htmlFor="create-resource-name"
            >
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                id="create-resource-name"
                maxLength={resourceInputLimits.resourceNameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
              <SlugHint slug={derivedSlug} error={fieldErrors.slug} />
            </Label>
            <Label className="grid gap-1 text-sm" htmlFor="create-resource-cap">
              <span className="text-muted-foreground">Base stockpile cap</span>
              <Input
                aria-invalid={fieldErrors.baseStockpileCap !== undefined}
                disabled={isPending}
                id="create-resource-cap"
                inputMode="decimal"
                placeholder="0"
                value={baseStockpileCap}
                onChange={(e) => {
                  setBaseStockpileCap(e.currentTarget.value);
                }}
              />
              {fieldErrors.baseStockpileCap !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.baseStockpileCap}
                </p>
              ) : null}
            </Label>
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
            <Button disabled={isPending} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
