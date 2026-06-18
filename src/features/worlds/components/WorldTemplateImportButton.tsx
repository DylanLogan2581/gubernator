import { useMutation, type QueryClient } from "@tanstack/react-query";
import { AlertTriangle, Upload } from "lucide-react";
import { useId, useRef, useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

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
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";

import {
  importWorldFromTemplateMutationOptions,
  type ImportWorldFromTemplateInput,
} from "../mutations/worldTemplateMutations";
import { parseWorldTemplate } from "../queries/worldTemplateExportQueries";
import {
  computeDryRunReport,
  type DryRunReport,
} from "../utils/worldTemplateDryRun";

// ---------------------------------------------------------------------------
// Main button
// ---------------------------------------------------------------------------
export function WorldTemplateImportButton({
  queryClient,
}: {
  readonly queryClient: QueryClient;
}): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<WorldTemplate | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file === undefined) return;

    // Reset state
    setParseError(null);
    setTemplate(null);

    const reader = new FileReader();
    reader.onload = (e): void => {
      const result = parseWorldTemplate(
        typeof e.target?.result === "string" ? e.target.result : "",
      );
      if (!result.ok) {
        setParseError(result.error);
      } else {
        setTemplate(result.data);
      }
    };
    reader.readAsText(file);

    // Reset so the same file can be re-selected after dismiss
    event.target.value = "";
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        aria-hidden="true"
        className="sr-only"
        onChange={handleFileChange}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload aria-hidden="true" />
        Import template
      </Button>

      {parseError !== null ? (
        <ImportErrorDialog
          error={parseError}
          onClose={() => {
            setParseError(null);
          }}
        />
      ) : null}

      {template !== null ? (
        <ImportConfirmDialog
          template={template}
          queryClient={queryClient}
          onClose={() => {
            setTemplate(null);
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Error dialog (parse / validation failure)
// ---------------------------------------------------------------------------
export function ImportErrorDialog({
  error,
  onClose,
}: {
  readonly error: string;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className="text-destructive"
              aria-hidden="true"
              size={18}
            />
            Invalid template
          </DialogTitle>
          <DialogDescription>
            The file could not be imported because it failed validation.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
          {error}
        </p>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog: dry-run report + name/visibility form
// ---------------------------------------------------------------------------
export function ImportConfirmDialog({
  template,
  queryClient,
  onClose,
}: {
  readonly template: WorldTemplate;
  readonly queryClient: QueryClient;
  readonly onClose: () => void;
}): JSX.Element {
  const nameId = useId();
  const visibilityId = useId();

  const report: DryRunReport = computeDryRunReport(template);

  const [name, setName] = useState(template.meta.name);
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const importMutation = useMutation(
    importWorldFromTemplateMutationOptions({ queryClient }),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);

    if (name.trim().length === 0) {
      setNameError("World name is required.");
      return;
    }

    if (report.danglingRefs.length > 0) {
      toast.error("Template has dangling references", {
        description: "Resolve the cross-reference errors before importing.",
      });
      return;
    }

    const input: ImportWorldFromTemplateInput = { name, visibility, template };
    importMutation.mutate(input, {
      onError: (error) => {
        toast.error("Import failed", {
          description:
            error instanceof Error
              ? error.message
              : "Could not import template.",
        });
      },
      onSuccess: () => {
        notifyMutationSuccess("World imported from template.");
        onClose();
      },
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !importMutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Import world from template</DialogTitle>
            <DialogDescription>
              Review the template contents and choose a name for the new world.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* Dry-run report */}
            <DryRunSummary report={report} templateName={template.meta.name} />

            {/* Name */}
            <div className="grid gap-1">
              <Label htmlFor={nameId} className="text-sm text-muted-foreground">
                World name
              </Label>
              <Input
                id={nameId}
                aria-invalid={nameError !== undefined}
                aria-label="World name"
                autoFocus
                disabled={importMutation.isPending}
                maxLength={textInputLimits.worldNameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {nameError !== undefined ? (
                <p className="text-xs text-destructive">{nameError}</p>
              ) : null}
            </div>

            {/* Visibility */}
            <div className="grid gap-1">
              <Label
                htmlFor={visibilityId}
                className="text-sm text-muted-foreground"
              >
                Visibility
              </Label>
              <NativeSelect
                id={visibilityId}
                className="w-full"
                disabled={importMutation.isPending}
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.currentTarget.value as "public" | "private");
                }}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </NativeSelect>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={importMutation.isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                importMutation.isPending || report.danglingRefs.length > 0
              }
            >
              {importMutation.isPending ? "Importing…" : "Import world"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Dry-run summary panel
// ---------------------------------------------------------------------------
export function DryRunSummary({
  report,
  templateName,
}: {
  readonly report: DryRunReport;
  readonly templateName: string;
}): JSX.Element {
  const { counts, danglingRefs } = report;

  const entityRows: Array<[string, number]> = [
    ["Resources", counts.resources],
    ["Jobs", counts.jobs],
    ["Blueprints", counts.blueprints],
    ["Blueprint tiers", counts.blueprintTiers],
    ["Deposit types", counts.depositTypes],
    ["Managed pop. types", counts.managedPopulationTypes],
    ["Namesets", counts.namesets],
  ];

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
      <p className="mb-2 font-medium">
        Template:{" "}
        <span className="font-normal text-muted-foreground">
          {templateName}
        </span>
      </p>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
        {entityRows
          .filter(([, count]) => count > 0)
          .map(([label, count]) => (
            <li key={label} className="flex justify-between">
              <span>{label}</span>
              <span className="font-mono">{count}</span>
            </li>
          ))}
      </ul>

      {danglingRefs.length > 0 ? (
        <div className="mt-3 space-y-1">
          <p className="flex items-center gap-1 font-medium text-destructive">
            <AlertTriangle size={14} aria-hidden="true" />
            Cross-reference errors ({danglingRefs.length})
          </p>
          <ul className="space-y-0.5 text-xs text-destructive">
            {danglingRefs.map((ref) => (
              <li key={ref}>{ref}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
