#!/usr/bin/env node
// Standalone dev-only scraper. Crawls fantasynamegenerators.com's "Real
// Names" (real-world cultures) and "Fantasy & Folklore" (fantasy races)
// categories -- the site's own taxonomy for person-name generators, matching
// this tool's scope -- converts each generator's script into the
// `type: "generated"` nameset config, and writes one JSON per generator plus
// a lazy-load index into src/features/namesets/library/.
//
// Not part of the app build; run with:
//   node --experimental-strip-types ./scripts/scrape-fng/run.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLibraryEntry,
  displayNameFromLinkText,
  slugFromHref,
} from "./buildLibraryEntry.ts";
import {
  crawlCategoryLinks,
  fetchGeneratorScript,
  launchBrowser,
} from "./crawlSite.ts";
import { isExcludedGenerator } from "./excludeList.ts";
import { generatedConfigSchema } from "./generatedConfigSchema.ts";
import { parseFngScript } from "./parseFngScript.ts";
import { buildReport, formatReportSummary } from "./report.ts";

import type { FlagRecord, LibraryEntry, SkipRecord } from "./types.ts";
import type { Browser } from "@playwright/test";

const INCLUDED_CATEGORIES = new Set([
  "Real Names",
  "Fantasy & Folklore",
  "Pop Culture",
]);
const CONCURRENCY = 8;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const libraryDir = path.join(
  repoRoot,
  "src",
  "features",
  "namesets",
  "library",
);

type Target = { href: string; text: string; category: string };

async function main(): Promise<void> {
  const browser = await launchBrowser();
  try {
    const categories = await crawlCategoryLinks(browser);

    // Additive crawl: generators already written to the library are kept as-is
    // (they are hand-verified and re-fetching them risks losing files to
    // transient Cloudflare failures). Only newly-discovered generators — e.g.
    // the Pop Culture category added on top of Real Names / Fantasy & Folklore
    // — are fetched and added.
    fs.mkdirSync(libraryDir, { recursive: true });
    const existingIds = new Set(
      fs
        .readdirSync(libraryDir)
        .filter((name) => name.endsWith(".json") && name !== "index.json")
        .map((name) => name.replace(/\.json$/, "")),
    );

    const targets = collectTargets(categories, existingIds);
    console.info(
      `discovered ${targets.length} new person-name generator targets ` +
        `(${existingIds.size} already in library, skipped)`,
    );

    const entries: LibraryEntry[] = [];
    const flagged: FlagRecord[] = [];
    const skipped: SkipRecord[] = [];

    let cursor = 0;
    async function worker(): Promise<void> {
      while (cursor < targets.length) {
        const index = cursor++;
        const target = targets[index];
        if (target === undefined) continue;
        await processTarget(browser, target, entries, flagged, skipped);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    for (const entry of entries) {
      fs.writeFileSync(
        path.join(libraryDir, `${entry.id}.json`),
        JSON.stringify(entry, null, 2) + "\n",
      );
    }
    writeIndex(entries);

    const report = buildReport(entries.length, flagged, skipped);
    fs.writeFileSync(
      path.join(scriptDir, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.info(formatReportSummary(report));
  } finally {
    await browser.close();
  }
}

function collectTargets(
  categories: { category: string; items: { href: string; text: string }[] }[],
  existingIds: ReadonlySet<string>,
): Target[] {
  const seen = new Set<string>();
  const targets: Target[] = [];
  for (const group of categories) {
    if (!INCLUDED_CATEGORIES.has(group.category)) continue;
    for (const item of group.items) {
      if (!/^[a-z0-9-]+\.php$/.test(item.href)) continue;
      if (seen.has(item.href)) continue;
      if (isExcludedGenerator(item.href)) continue;
      if (existingIds.has(slugFromHref(item.href))) continue;
      seen.add(item.href);
      targets.push({
        href: item.href,
        text: item.text,
        category: group.category,
      });
    }
  }
  return targets;
}

async function processTarget(
  browser: Browser,
  target: Target,
  entries: LibraryEntry[],
  flagged: FlagRecord[],
  skipped: SkipRecord[],
): Promise<void> {
  const id = slugFromHref(target.href);
  const displayName = displayNameFromLinkText(target.text);
  const sourceUrl = `https://fantasynamegenerators.com/${target.href}`;

  const fetched = await fetchGeneratorScript(browser, target.href);
  if ("error" in fetched) {
    skipped.push({ id, displayName, sourceUrl, reason: fetched.error });
    return;
  }

  const parsed = parseFngScript(fetched.source);
  if (parsed.status === "flagged") {
    flagged.push({ id, displayName, sourceUrl, reason: parsed.reason });
    return;
  }

  const validation = generatedConfigSchema.safeParse(parsed.config);
  if (!validation.success) {
    flagged.push({
      id,
      displayName,
      sourceUrl,
      reason: `schema validation failed: ${validation.error.message}`,
    });
    return;
  }

  entries.push(
    buildLibraryEntry({
      href: target.href,
      linkText: target.text,
      category: target.category,
      config: parsed.config,
    }),
  );
}

type IndexEntry = { id: string; displayName: string; category: string };

function writeIndex(entries: LibraryEntry[]): void {
  // Merge freshly-crawled entries with the existing index so previously
  // written generators (kept on disk by the additive crawl) stay listed.
  const indexPath = path.join(libraryDir, "index.json");
  const byId = new Map<string, IndexEntry>();
  if (fs.existsSync(indexPath)) {
    const existing = JSON.parse(
      fs.readFileSync(indexPath, "utf8"),
    ) as IndexEntry[];
    for (const entry of existing) {
      // Drop stale index rows whose definition file no longer exists.
      if (fs.existsSync(path.join(libraryDir, `${entry.id}.json`))) {
        byId.set(entry.id, entry);
      }
    }
  }
  for (const entry of entries) {
    byId.set(entry.id, {
      id: entry.id,
      displayName: entry.displayName,
      category: entry.category,
    });
  }
  const index = [...byId.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  fs.writeFileSync(
    path.join(libraryDir, "index.json"),
    JSON.stringify(index, null, 2) + "\n",
  );
}

await main();
