import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Download, Library, Upload } from "lucide-react";
import { useRef, useState, type JSX, type ReactNode } from "react";
import { toast } from "sonner";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";

import {
  parseWorldTemplate,
  serializeWorldTemplate,
} from "../queries/worldTemplateExportQueries";
import { BUNDLED_SCENARIOS } from "../scenarios/bundledScenarios";
import { computeDryRunReport } from "../utils/worldTemplateDryRun";

import {
  ImportConfirmDialog,
  ImportErrorDialog,
} from "./WorldTemplateImportButton";

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

function TemplateLibraryFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className="mx-auto max-w-5xl py-6">{children}</div>;
}

// ---------------------------------------------------------------------------
// Bundled scenario card
// ---------------------------------------------------------------------------

function BundledScenarioCard({
  scenario,
  onCreateWorld,
}: {
  readonly scenario: (typeof BUNDLED_SCENARIOS)[number];
  readonly onCreateWorld: (template: WorldTemplate) => void;
}): JSX.Element {
  const report = computeDryRunReport(scenario.template);
  const { counts } = report;

  const allCounts: Array<[string, number]> = [
    ["Resources", counts.resources],
    ["Jobs", counts.jobs],
    ["Blueprints", counts.blueprints],
    ["Deposit types", counts.depositTypes],
  ];
  const summaryItems = allCounts.filter(([, n]) => n > 0);

  function handleDownload(): void {
    const json = serializeWorldTemplate(scenario.template);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${scenario.template.meta.slug}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Scenario downloaded", {
      description: `Saved as ${scenario.template.meta.slug}.json`,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {scenario.name}
        </CardTitle>
        <CardDescription>{scenario.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-muted-foreground">
          {summaryItems.map(([label, count]) => (
            <li key={label} className="flex justify-between">
              <span>{label}</span>
              <span className="font-mono">{count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          aria-label={`Download ${scenario.name} as JSON template`}
        >
          <Download aria-hidden="true" />
          Download
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            onCreateWorld(scenario.template);
          }}
        >
          Create world
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Upload section
// ---------------------------------------------------------------------------

function UploadSection({
  onTemplate,
}: {
  readonly onTemplate: (template: WorldTemplate) => void;
}): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file === undefined) return;

    setParseError(null);

    const reader = new FileReader();
    reader.onload = (e): void => {
      const raw = typeof e.target?.result === "string" ? e.target.result : "";
      const result = parseWorldTemplate(raw);
      if (!result.ok) {
        setParseError(result.error);
      } else {
        onTemplate(result.data);
      }
    };
    reader.readAsText(file);

    event.target.value = "";
  }

  return (
    <div className="flex items-center gap-3">
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
        onClick={() => {
          fileInputRef.current?.click();
        }}
      >
        <Upload aria-hidden="true" />
        Upload template JSON
      </Button>
      {parseError !== null ? (
        <ImportErrorDialog
          error={parseError}
          onClose={() => {
            setParseError(null);
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function TemplateLibraryPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [pendingTemplate, setPendingTemplate] = useState<WorldTemplate | null>(
    null,
  );

  return (
    <TemplateLibraryFrame>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/superadmin">Superadmin</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Template Library</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Library
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <div>
              <h1 className="text-xl font-semibold">Template Library</h1>
              <p className="text-sm text-muted-foreground">
                Browse bundled scenarios, import uploaded templates, or create
                worlds directly from any template.
              </p>
            </div>
          </div>
          <UploadSection
            onTemplate={(t) => {
              setPendingTemplate(t);
            }}
          />
        </div>

        {/* Bundled scenarios */}
        <section aria-label="Bundled scenarios">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Bundled scenarios
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {BUNDLED_SCENARIOS.map((scenario) => (
              <BundledScenarioCard
                key={scenario.id}
                scenario={scenario}
                onCreateWorld={(t) => {
                  setPendingTemplate(t);
                }}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Import dialog */}
      {pendingTemplate !== null ? (
        <ImportConfirmDialog
          template={pendingTemplate}
          queryClient={queryClient}
          onClose={() => {
            setPendingTemplate(null);
          }}
        />
      ) : null}
    </TemplateLibraryFrame>
  );
}
