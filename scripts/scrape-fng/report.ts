import type { FlagRecord, ScrapeReport, SkipRecord } from "./types.ts";

export function buildReport(
  convertedCount: number,
  flagged: FlagRecord[],
  skipped: SkipRecord[],
): ScrapeReport {
  return {
    convertedCount,
    flaggedCount: flagged.length,
    skippedCount: skipped.length,
    flagged,
    skipped,
  };
}

export function formatReportSummary(report: ScrapeReport): string {
  const lines = [
    `converted: ${report.convertedCount}`,
    `flagged:   ${report.flaggedCount}`,
    `skipped:   ${report.skippedCount}`,
    "",
    "flagged (manual review):",
    ...report.flagged.map((f) => `  - ${f.id}: ${f.reason} (${f.sourceUrl})`),
    "",
    "skipped (fetch/discovery failures):",
    ...report.skipped.map((s) => `  - ${s.id}: ${s.reason} (${s.sourceUrl})`),
    ...(report.spotCheck === undefined
      ? []
      : [
          "",
          "spot check (converted output vs. live FNG page):",
          ...report.spotCheck.map((s) => `  - ${s.id}: ${s.verdict}`),
        ]),
  ];
  return lines.join("\n");
}
