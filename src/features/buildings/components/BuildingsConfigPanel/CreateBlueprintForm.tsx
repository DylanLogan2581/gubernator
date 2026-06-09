import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  activeJobsByWorldQueryOptions,
} from "@/features/jobs";
import {
  activeResourcesByWorldQueryOptions,
} from "@/features/resources";
import { buildingInputLimits } from "@/lib/inputLimits";
import { toSlug } from "@/lib/slugify";

import {
  createBlueprintInputSchema,
  type CreateBlueprintInput,
} from "../../schemas/buildingSchemas";
import { useCreateBlueprintWithTiers } from "../../hooks/useCreateBlueprintWithTiers";
import InlineTierDraftForm from "./InlineTierDraftForm";
import type { PendingTierDraft } from "../../hooks/useCreateBlueprintWithTiers";

type BlueprintFieldErrors = {
  readonly description?: string;
  readonly gracePeriodTurns?: string;
  readonly maxInstancesPerSettlement?: string;
  readonly name?: string;
  readonly slug?: string;
};

export function CreateBlueprintForm({
  onCancel,
  onSubmit,
  worldId,
}: {
  readonly onCancel: () => void;
  readonly onSubmit: (
    input: CreateBlueprintInput,
    pendingTiers: readonly PendingTierDraft[],
  ) => void;
  readonly worldId: string;
}): JSX.Element {
  const { isCreating } = useCreateBlueprintWithTiers();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gracePeriodTurns, setGracePeriodTurns] = useState("0");
  const [maxInstances, setMaxInstances] = useState("");
  const [fieldErrors, setFieldErrors] = useState<BlueprintFieldErrors>({});
  const [pendingTiers, setPendingTiers] = useState<PendingTierDraft[]>([]);
  const [showAddTierForm, setShowAddTierForm] = useState(false);

  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const jobsQuery = useQuery(activeJobsByWorldQueryOptions(worldId));
  const tiersReady = resourcesQuery.isSuccess && jobsQuery.isSuccess;

  const derivedSlug = toSlug(name, {
    maxLength: buildingInputLimits.blueprintSlugMax,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldErrors({});

    const input: CreateBlueprintInput = {
      description: description.length > 0 ? description : undefined,
      gracePeriodTurns:
        gracePeriodTurns !== "" ? parseInt(gracePeriodTurns, 10) : undefined,
      maxInstancesPerSettlement:
        maxInstances !== "" ? parseInt(maxInstances, 10) : undefined,
      name,
      slug: derivedSlug,
      worldId,
    };

    const result = createBlueprintInputSchema.safeParse(input);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors({
        description: errors.description,
        gracePeriodTurns: errors.gracePeriodTurns,
        maxInstancesPerSettlement: errors.maxInstancesPerSettlement,
        name: errors.name,
        slug: errors.slug,
      });
      return;
    }

    onSubmit(input, pendingTiers);
  }

  const nextTierNumber =
    pendingTiers.length > 0
      ? Math.max(...pendingTiers.map((t) => t.tierNumber)) + 1
      : 1;

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
            <DialogTitle>Create blueprint</DialogTitle>
            <DialogDescription className="sr-only">
              Define a building blueprint and its construction tiers.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="blueprint-name">Name</Label>
              <Input
                id="blueprint-name"
                aria-invalid={fieldErrors.name !== undefined}
                disabled={isCreating}
                maxLength={buildingInputLimits.blueprintNameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
              <SlugHint slug={derivedSlug} error={fieldErrors.slug} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="blueprint-description">Description</Label>
              <Textarea
                id="blueprint-description"
                aria-invalid={fieldErrors.description !== undefined}
                disabled={isCreating}
                maxLength={buildingInputLimits.blueprintDescriptionMax}
                value={description}
                onChange={(e) => {
                  setDescription(e.currentTarget.value);
                }}
              />
              {fieldErrors.description !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.description}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1">
              <Label htmlFor="grace-period-turns">Grace period (turns)</Label>
              <Input
                id="grace-period-turns"
                aria-invalid={fieldErrors.gracePeriodTurns !== undefined}
                disabled={isCreating}
                inputMode="numeric"
                placeholder="0"
                value={gracePeriodTurns}
                onChange={(e) => {
                  setGracePeriodTurns(e.currentTarget.value);
                }}
              />
              {fieldErrors.gracePeriodTurns !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.gracePeriodTurns}
                </p>
              ) : null}
            </div>
            <div className="grid gap-1">
              <Label htmlFor="max-instances-settlement">
                Max instances per settlement
              </Label>
              <Input
                id="max-instances-settlement"
                aria-invalid={
                  fieldErrors.maxInstancesPerSettlement !== undefined
                }
                disabled={isCreating}
                inputMode="numeric"
                placeholder="Unlimited"
                value={maxInstances}
                onChange={(e) => {
                  setMaxInstances(e.currentTarget.value);
                }}
              />
              {fieldErrors.maxInstancesPerSettlement !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.maxInstancesPerSettlement}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 border-t border-border pt-3">
            <span className="text-sm font-medium">
              Initial tiers (optional)
            </span>

            {pendingTiers.length > 0 ? (
              <ul aria-label="Pending tiers" className="grid gap-2">
                {pendingTiers.map((draft) => (
                  <li
                    key={draft.id}
                    className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2"
                  >
                    <span className="text-sm">
                      Tier {draft.tierNumber}
                      {draft.workerTurnsRequired !== undefined
                        ? ` — ${String(draft.workerTurnsRequired)} worker turn${draft.workerTurnsRequired !== 1 ? "s" : ""}`
                        : ""}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isCreating}
                      onClick={() => {
                        setPendingTiers((prev) =>
                          prev.filter((t) => t.id !== draft.id),
                        );
                      }}
                    >
                      <X aria-hidden="true" className="text-destructive" />
                      <span className="sr-only">
                        Remove tier {draft.tierNumber}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}

            {!showAddTierForm ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={isCreating || !tiersReady}
                onClick={() => {
                  setShowAddTierForm(true);
                }}
              >
                <Plus aria-hidden="true" />
                Add tier
              </Button>
            ) : null}

            {showAddTierForm && tiersReady ? (
              <InlineTierDraftForm
                activeJobs={jobsQuery.data}
                activeResources={resourcesQuery.data}
                defaultTierNumber={nextTierNumber}
                disabled={isCreating}
                onAdd={(draft) => {
                  setPendingTiers((prev) => [...prev, draft]);
                  setShowAddTierForm(false);
                }}
                onCancel={() => {
                  setShowAddTierForm(false);
                }}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <DialogFooter>
              <Button
                disabled={isCreating}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isCreating || showAddTierForm} type="submit">
                Create
              </Button>
            </DialogFooter>
            {showAddTierForm ? (
              <p className="text-sm text-muted-foreground">
                Finish or cancel the tier draft first.
              </p>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
