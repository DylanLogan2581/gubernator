import { useState, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LawDocumentVersionBrowser } from "@/features/law-documents";

import type {
  LawAmendment,
  LawAmendmentStatus,
} from "../types/lawAmendmentTypes";

const STATUS_LABELS: Readonly<Record<LawAmendmentStatus, string>> = {
  expired: "Expired",
  failed: "Failed",
  passed: "Passed",
  proposed: "Proposed",
  withdrawn: "Withdrawn",
};

const STATUS_BADGE_VARIANTS: Readonly<
  Record<
    LawAmendmentStatus,
    "success" | "warning" | "destructive" | "secondary"
  >
> = {
  expired: "secondary",
  failed: "destructive",
  passed: "success",
  proposed: "warning",
  withdrawn: "secondary",
};

// Resolved (non-"proposed") amendments, with a link to the version each
// passed amendment enacted (law_amendments.enacted_version, #1300).
export function ResolvedAmendmentsList({
  amendments,
  documentId,
  documentTitle,
  versionByAmendmentId,
}: {
  readonly amendments: readonly LawAmendment[];
  readonly documentId: string;
  readonly documentTitle: string;
  readonly versionByAmendmentId: ReadonlyMap<string, number>;
}): JSX.Element {
  const [browsingVersions, setBrowsingVersions] = useState(false);

  if (amendments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No resolved amendments yet.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-2">
        {amendments.map((amendment) => (
          <li
            key={amendment.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
          >
            <span className="text-sm font-medium">{amendment.title}</span>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_BADGE_VARIANTS[amendment.status]}>
                {STATUS_LABELS[amendment.status]}
              </Badge>
              {versionByAmendmentId.has(amendment.id) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setBrowsingVersions(true)}
                >
                  → v{versionByAmendmentId.get(amendment.id)}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {browsingVersions ? (
        <LawDocumentVersionBrowser
          documentId={documentId}
          documentTitle={documentTitle}
          onClose={() => setBrowsingVersions(false)}
        />
      ) : null}
    </>
  );
}
