import { useMutation, type QueryClient } from "@tanstack/react-query";
import { AlertTriangle, Upload } from "lucide-react";
import {
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type JSX,
  type RefObject,
} from "react";

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
import { textInputLimits } from "@/lib/inputLimits";
import {
  notifyError,
  notifyMutationSuccess,
  resolveMutationErrorMessage,
} from "@/lib/notify";
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

export type WorldTemplateImportButtonHandle = {
  readonly openFilePicker: () => void;
};

// ---------------------------------------------------------------------------
// Main button
// ---------------------------------------------------------------------------
export function WorldTemplateImportButton({
  queryClient,
  ref,
}: {
  readonly queryClient: QueryClient;
  readonly ref?: RefObject<WorldTemplateImportButtonHandle | null>;
}): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<WorldTemplate | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    openFilePicker: () => {
      fileInputRef.current?.click();
    },
  }));

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
        tabIndex={-1}
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
// Confirm dialog: dry-run report + name form
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

  const report: DryRunReport = computeDryRunReport(template);

  const [name, setName] = useState(template.meta.name);
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
      notifyError("Template has dangling references", {
        description: "Resolve the cross-reference errors before importing.",
      });
      return;
    }

    const input: ImportWorldFromTemplateInput = { name, template };
    importMutation.mutate(input, {
      onError: (error) => {
        notifyError("Import failed", {
          description: resolveMutationErrorMessage(
            error,
            "Could not import template.",
          ),
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
  const { counts, danglingRefs, warnings } = report;

  const entityRows: Array<[string, number]> = [
    ["Resource categories", counts.resourceCategories],
    ["Education levels", counts.educationLevels],
    ["Cultures", counts.cultures],
    ["Religions", counts.religions],
    ["Resources", counts.resources],
    ["Jobs", counts.jobs],
    ["Blueprints", counts.blueprints],
    ["Blueprint tiers", counts.blueprintTiers],
    ["Deposit types", counts.depositTypes],
    ["Managed pop. types", counts.managedPopulationTypes],
    ["Unit types", counts.unitTypes],
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

      {warnings.length > 0 ? (
        <div className="mt-3 space-y-1">
          <p className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-500">
            <AlertTriangle size={14} aria-hidden="true" />
            Warnings ({warnings.length})
          </p>
          <ul className="space-y-0.5 text-xs text-amber-600 dark:text-amber-500">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
