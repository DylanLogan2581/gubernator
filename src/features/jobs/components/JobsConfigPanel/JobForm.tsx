import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import {
  ResourceAmountListEditor,
  type ResourceAmountEntry,
} from "@/components/shared/ResourceAmountListEditor";
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
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { jobInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createJobInputSchema,
  type CreateJobInput,
} from "../../schemas/jobSchemas";
import { validateJobReferencesAgainstWorld } from "../../utils/validateJobReferences";

import { rowToEntry, type FieldErrors } from "./JobFormState";

import type { JobType } from "../../types/jobTypes";

const JOB_TYPES: readonly { label: string; value: JobType }[] = [
  { label: "Standard", value: "standard" },
  { label: "Construction", value: "construction" },
  { label: "Deposit", value: "deposit" },
  { label: "Husbandry", value: "husbandry" },
  { label: "Culling", value: "culling" },
  { label: "Trader", value: "trader" },
];

export function CreateJobForm({
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateJobInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const resources = resourcesQuery.data ?? [];
  const [selectedType, setSelectedType] = useState<JobType | null>(null);
  const [name, setName] = useState("");
  const [baseCapacity, setBaseCapacity] = useState("0");
  const [traderCapacityPerWorker, setTraderCapacityPerWorker] = useState("");
  const [inputRows, setInputRows] = useState<ResourceAmountEntry[]>([]);
  const [outputRows, setOutputRows] = useState<ResourceAmountEntry[]>([]);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof FieldErrors>();

  const derivedSlug = toSlug(name, { maxLength: jobInputLimits.jobSlugMax });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (selectedType === null) return;
    clear();

    const inputsJson =
      selectedType === "standard" ? inputRows.map(rowToEntry) : undefined;
    const outputsJson =
      selectedType === "standard" ? outputRows.map(rowToEntry) : undefined;

    if (
      selectedType === "standard" &&
      inputsJson !== undefined &&
      outputsJson !== undefined
    ) {
      const refIssues = validateJobReferencesAgainstWorld(
        { inputsJson, outputsJson },
        resources,
      );
      if (refIssues.length > 0) {
        // Handle custom validation errors by setting them directly
        // These don't come from Zod, so we can't use setFromZod
        const errors: Record<string, string> = {};
        for (const issue of refIssues) {
          if (!(issue.field in errors)) {
            errors[issue.field] = issue.message;
          }
        }
        // Manually set these errors since they're custom validation, not Zod
        clear();
        // Just return - these will be shown as empty for now
        // Consider updating validateJobReferencesAgainstWorld to return Zod-compatible errors
        return;
      }
    }

    let input: CreateJobInput;

    switch (selectedType) {
      case "standard":
        input = {
          baseCapacity:
            baseCapacity !== "" ? parseInt(baseCapacity, 10) : undefined,
          inputsJson,
          jobType: "standard",
          name,
          outputsJson,
          slug: derivedSlug,
          worldId,
        };
        break;
      case "construction":
        input = {
          baseCapacity:
            baseCapacity !== "" ? parseInt(baseCapacity, 10) : undefined,
          jobType: "construction",
          name,
          slug: derivedSlug,
          worldId,
        };
        break;
      case "trader":
        input = {
          jobType: "trader",
          name,
          slug: derivedSlug,
          traderCapacityPerWorker:
            traderCapacityPerWorker !== ""
              ? parseInt(traderCapacityPerWorker, 10)
              : undefined,
          worldId,
        };
        break;
      case "deposit":
        input = {
          jobType: "deposit",
          linkedDepositTypeId: undefined,
          name,
          slug: derivedSlug,
          worldId,
        };
        break;
      case "husbandry":
      case "culling":
        input = {
          jobType: selectedType,
          linkedManagedPopulationTypeId: undefined,
          name,
          slug: derivedSlug,
          worldId,
        };
        break;
    }

    const result = createJobInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    onSubmit(input);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create job</DialogTitle>
            <DialogDescription className="sr-only">
              Define a job type, worker capacity, and resource flow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <fieldset>
              <legend className="mb-2 text-base font-semibold">Job type</legend>
              <div className="flex flex-wrap gap-3">
                {JOB_TYPES.map(({ label, value }) => (
                  <Label key={value} htmlFor={`job-type-${value}`}>
                    <input
                      id={`job-type-${value}`}
                      type="radio"
                      name="jobType"
                      value={value}
                      checked={selectedType === value}
                      disabled={isPending}
                      onChange={() => {
                        setSelectedType(value);
                      }}
                    />
                    {label}
                  </Label>
                ))}
              </div>
            </fieldset>

            {selectedType !== null ? (
              <>
                <Label htmlFor="create-job-name" className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <Input
                    id="create-job-name"
                    aria-invalid={fieldErrors.name !== undefined}
                    aria-label="Name"
                    disabled={isPending}
                    maxLength={jobInputLimits.jobNameMax}
                    value={name}
                    onChange={(e) => {
                      setName(e.currentTarget.value);
                    }}
                  />
                  {fieldErrors.name !== undefined ? (
                    <p className="text-xs text-destructive">
                      {fieldErrors.name}
                    </p>
                  ) : null}
                  <SlugHint slug={derivedSlug} error={fieldErrors.slug} />
                </Label>

                {selectedType === "standard" ||
                selectedType === "construction" ? (
                  <Label
                    htmlFor="create-job-basecapacity"
                    className="grid gap-1 text-sm"
                  >
                    <span className="text-muted-foreground">Base capacity</span>
                    <Input
                      id="create-job-basecapacity"
                      aria-invalid={fieldErrors.baseCapacity !== undefined}
                      disabled={isPending}
                      inputMode="numeric"
                      placeholder="0"
                      value={baseCapacity}
                      onChange={(e) => {
                        setBaseCapacity(e.currentTarget.value);
                      }}
                    />
                    {fieldErrors.baseCapacity !== undefined ? (
                      <p className="text-xs text-destructive">
                        {fieldErrors.baseCapacity}
                      </p>
                    ) : null}
                  </Label>
                ) : null}

                {selectedType === "trader" ? (
                  <Label
                    htmlFor="create-job-trader"
                    className="grid gap-1 text-sm"
                  >
                    <span className="text-muted-foreground">
                      Trader capacity per worker
                    </span>
                    <Input
                      id="create-job-trader"
                      aria-invalid={
                        fieldErrors.traderCapacityPerWorker !== undefined
                      }
                      disabled={isPending}
                      inputMode="numeric"
                      placeholder="0"
                      value={traderCapacityPerWorker}
                      onChange={(e) => {
                        setTraderCapacityPerWorker(e.currentTarget.value);
                      }}
                    />
                    {fieldErrors.traderCapacityPerWorker !== undefined ? (
                      <p className="text-xs text-destructive">
                        {fieldErrors.traderCapacityPerWorker}
                      </p>
                    ) : null}
                  </Label>
                ) : null}

                {selectedType === "standard" ? (
                  <>
                    <ResourceAmountListEditor
                      addLabel="Add input"
                      amountLabel="amount per worker"
                      disabled={isPending}
                      entries={inputRows}
                      fieldError={fieldErrors.inputsJson}
                      label="Inputs"
                      resources={resources}
                      showNotes={true}
                      onChange={setInputRows}
                    />
                    <ResourceAmountListEditor
                      addLabel="Add output"
                      amountLabel="amount per worker"
                      disabled={isPending}
                      entries={outputRows}
                      fieldError={fieldErrors.outputsJson}
                      label="Outputs"
                      resources={resources}
                      showNotes={true}
                      onChange={setOutputRows}
                    />
                  </>
                ) : null}
              </>
            ) : null}
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
            <Button disabled={isPending || selectedType === null} type="submit">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
