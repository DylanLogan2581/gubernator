// Cross-cutting types for the FNG scraper. Dev-only tooling, not bundled into the app.

export type NmLists = Record<string, string[]>;

export type NamePatternElement = string | string[];

export type GeneratedPatterns = {
  female_given: NamePatternElement[];
  male_given: NamePatternElement[];
  surname: NamePatternElement[];
};

export type GeneratedConfig = {
  type: "generated";
  convention: "pool" | "none";
  parts: NmLists;
  patterns: GeneratedPatterns;
};

export type ParseSuccess = {
  status: "converted";
  config: GeneratedConfig;
};

export type ParseFlagged = {
  status: "flagged";
  reason: string;
};

export type ParseResult = ParseSuccess | ParseFlagged;

export type CategoryLink = {
  href: string;
  text: string;
};

export type CategoryLinks = {
  category: string;
  items: CategoryLink[];
};

export type LibraryEntry = {
  id: string;
  displayName: string;
  category: string;
  sourceUrl: string;
  config: GeneratedConfig;
};

export type SkipRecord = {
  id: string;
  displayName: string;
  sourceUrl: string;
  reason: string;
};

export type FlagRecord = {
  id: string;
  displayName: string;
  sourceUrl: string;
  reason: string;
};

export type SpotCheckRecord = {
  id: string;
  liveSample: string;
  localSample: string;
  verdict: string;
};

export type ScrapeReport = {
  convertedCount: number;
  flaggedCount: number;
  skippedCount: number;
  flagged: FlagRecord[];
  skipped: SkipRecord[];
  // Filled in by hand after a run, comparing a few converted generators'
  // output against the live FNG page (see acceptance criteria). Not
  // populated by run.ts itself, since it requires eyeballing the live site.
  spotCheck?: SpotCheckRecord[];
};
