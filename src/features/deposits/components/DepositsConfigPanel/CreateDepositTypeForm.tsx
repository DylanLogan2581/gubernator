import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, type JSX, useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
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
import { NativeSelect } from "@/components/ui/native-select";
import { type JobDefinition } from "@/features/jobs";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { depositInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";
import { sortByName } from "@/lib/sortUtils";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import {
  createDepositTypeInputSchema,
  type CreateDepositTypeInput,
} from "../../schemas/depositSchemas";

import type { DepositType } from "../../types/depositTypes";

type DepositTypeFieldErrors = {
  readonly jobId?: string;
  readonly name?: string;
  readonly outputUnitsPerWorker?: string;
  readonly slug?: string;
};

export function CreateDepositTypeForm({
  allDepositTypes,
  depositJobs,
  isPending,
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly allDepositTypes: readonly DepositType[];
  readonly depositJobs: readonly JobDefinition[];
  readonly isPending: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (input: CreateDepositTypeInput) => void;
  readonly worldId: string;
}): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const [name, setName] = useState("");
  const [jobId, setJobId] = useState("");
  const [outputUnitsPerWorker, setOutputUnitsPerWorker] = useState("1");
  const [workerInputs, setWorkerInputs] = useState<ResourceAmountEntry[]>([]);
  const { fieldErrors, setFromZod, clear } =
    useFieldErrors<keyof DepositTypeFieldErrors>();
  const [jobLinkError, setJobLinkError] = useState<string | undefined>(
    undefined,
  );

  function handleJobChange(selectedJobId: string): void {
    setJobId(selectedJobId);
    const conflict = allDepositTypes.find(
      (dt) => dt.jobId === selectedJobId && selectedJobId !== "",
    );
    setJobLinkError(
      conflict !== undefined
        ? `This job is already linked to "${conflict.name}".`
        : undefined,
    );
  }

  const derivedSlug = toSlug(name, {
    maxLength: depositInputLimits.depositTypeSlugMax,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    if (jobLinkError !== undefined) return;

    const input: CreateDepositTypeInput = {
      jobId,
      name,
      outputUnitsPerWorker:
        outputUnitsPerWorker !== "" ? parseInt(outputUnitsPerWorker, 10) : 0,
      slug: derivedSlug,
      workerInputsJson:
        workerInputs.length > 0
          ? workerInputs.map((e) => ({
              amountPerWorker: parseFloat(e.amount),
              resourceId: e.resourceId,
            }))
          : undefined,
      worldId,
    };

    const result = createDepositTypeInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    onSubmit(input);
  }

  const resources = resourcesQuery.data ?? [];

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
            <DialogTitle>Create deposit type</DialogTitle>
            <DialogDescription>
              Define a deposit type, worker settings, and resource outputs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label htmlFor="deposit-create-name" className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                id="deposit-create-name"
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={isPending}
                maxLength={depositInputLimits.depositTypeNameMax}
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
            {depositJobs.length === 0 ? (
              <div className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  Linked deposit job
                </span>
                <EmptyState
                  title="No deposit jobs yet"
                  description="Create one to assign to this deposit type."
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/worlds/$worldId/configuration"
                        params={{ worldId }}
                        search={{ tab: "jobs" }}
                      >
                        Create deposit job
                      </Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <Label
                htmlFor="deposit-create-job"
                className="grid gap-1 text-sm"
              >
                <span className="text-muted-foreground">
                  Linked deposit job
                </span>
                <NativeSelect
                  id="deposit-create-job"
                  aria-invalid={
                    fieldErrors.jobId !== undefined ||
                    jobLinkError !== undefined
                  }
                  className="w-full"
                  disabled={isPending}
                  value={jobId}
                  onChange={(e) => {
                    handleJobChange(e.currentTarget.value);
                  }}
                >
                  <option value="">Select a deposit job…</option>
                  {sortByName(depositJobs).map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.name}
                    </option>
                  ))}
                </NativeSelect>
                {jobLinkError !== undefined ? (
                  <p className="text-xs text-destructive">{jobLinkError}</p>
                ) : fieldErrors.jobId !== undefined ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.jobId}
                  </p>
                ) : null}
              </Label>
            )}
            <Label
              htmlFor="deposit-create-output"
              className="grid gap-1 text-sm"
            >
              <span className="text-muted-foreground">
                Output units per worker
              </span>
              <Input
                id="deposit-create-output"
                aria-invalid={fieldErrors.outputUnitsPerWorker !== undefined}
                disabled={isPending}
                inputMode="numeric"
                placeholder="1"
                value={outputUnitsPerWorker}
                onChange={(e) => {
                  setOutputUnitsPerWorker(e.currentTarget.value);
                }}
              />
              {fieldErrors.outputUnitsPerWorker !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.outputUnitsPerWorker}
                </p>
              ) : null}
            </Label>
            <ResourceAmountListEditor
              addLabel="Add input"
              amountLabel="amount per worker"
              disabled={isPending}
              entries={workerInputs}
              label="Worker inputs"
              resources={resources}
              onChange={setWorkerInputs}
            />
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
            <Button
              disabled={isPending || jobLinkError !== undefined}
              type="submit"
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
