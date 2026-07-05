import {
  readLocalStorageItem,
  writeLocalStorageItem,
} from "@/lib/localStorage";

// Small "where was I" ring buffer backing the command palette's Recents
// section (#1011) — the last MAX_ENTRIES entity pages the viewer visited,
// browser-local only (no server tracking), mirroring
// features/worlds/utils/lastWorldPin.ts's storage pattern. Lives in
// src/lib rather than src/components/app since the JSON (de)serialization
// below isn't allowed in UI-layer modules (see uiLayerRestrictedSyntax in
// eslint.config.ts).
const STORAGE_KEY = "gubernator:recent-pages";
const MAX_ENTRIES = 8;

export type RecentPageEntry =
  | {
      readonly kind: "citizen";
      readonly citizenId: string;
      readonly label: string;
      readonly path: string;
      readonly worldId: string;
    }
  | {
      readonly kind: "nation";
      readonly label: string;
      readonly nationId: string;
      readonly path: string;
      readonly worldId: string;
    }
  | {
      readonly kind: "settlement";
      readonly label: string;
      readonly nationId: string;
      readonly path: string;
      readonly settlementId: string;
      readonly worldId: string;
    }
  | {
      readonly kind: "world";
      readonly label: string;
      readonly path: string;
      readonly worldId: string;
    };

// `Omit<RecentPageEntry, "label">` collapses to the union members' common
// keys only (a `keyof` on a union intersects, not distributes), so the
// per-kind id fields have to be spelled out again here instead.
export type EntityPathMatch =
  | {
      readonly kind: "citizen";
      readonly citizenId: string;
      readonly path: string;
      readonly worldId: string;
    }
  | {
      readonly kind: "nation";
      readonly nationId: string;
      readonly path: string;
      readonly worldId: string;
    }
  | {
      readonly kind: "settlement";
      readonly nationId: string;
      readonly path: string;
      readonly settlementId: string;
      readonly worldId: string;
    }
  | {
      readonly kind: "world";
      readonly path: string;
      readonly worldId: string;
    };

// Matches a pathname against the entity detail pages worth remembering
// (world dashboard, nation overview, settlement overview, citizen detail).
// Deeper sub-pages (e.g. a nation's /government tab) intentionally don't
// match — the ring tracks entity landing pages, not every route.
export function matchEntityPath(pathname: string): EntityPathMatch | null {
  const settlementMatch = pathname.match(
    /^\/worlds\/([^/]+)\/nations\/([^/]+)\/settlements\/([^/]+)$/,
  );
  if (settlementMatch !== null) {
    const [, worldId, nationId, settlementId] = settlementMatch;
    return {
      kind: "settlement",
      nationId,
      path: pathname,
      settlementId,
      worldId,
    };
  }

  const nationMatch = pathname.match(/^\/worlds\/([^/]+)\/nations\/([^/]+)$/);
  if (nationMatch !== null) {
    const [, worldId, nationId] = nationMatch;
    return { kind: "nation", nationId, path: pathname, worldId };
  }

  const citizenMatch = pathname.match(/^\/worlds\/([^/]+)\/citizens\/([^/]+)$/);
  if (citizenMatch !== null) {
    const [, worldId, citizenId] = citizenMatch;
    return { kind: "citizen", citizenId, path: pathname, worldId };
  }

  const worldMatch = pathname.match(/^\/worlds\/([^/]+)$/);
  if (worldMatch !== null) {
    const [, worldId] = worldMatch;
    return { kind: "world", path: pathname, worldId };
  }

  return null;
}

function isRecentPageEntry(value: unknown): value is RecentPageEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.kind !== "string" ||
    typeof candidate.label !== "string" ||
    typeof candidate.path !== "string" ||
    typeof candidate.worldId !== "string"
  ) {
    return false;
  }

  switch (candidate.kind) {
    case "citizen":
      return typeof candidate.citizenId === "string";
    case "nation":
      return typeof candidate.nationId === "string";
    case "settlement":
      return (
        typeof candidate.nationId === "string" &&
        typeof candidate.settlementId === "string"
      );
    case "world":
      return true;
    default:
      return false;
  }
}

export function readRecentPages(): readonly RecentPageEntry[] {
  const raw = readLocalStorageItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentPageEntry) : [];
  } catch {
    return [];
  }
}

// Re-visiting a path bumps its existing entry to the front instead of
// duplicating it; the ring is capped at MAX_ENTRIES, most-recent first.
export function recordRecentPage(entry: RecentPageEntry): void {
  const next = [
    entry,
    ...readRecentPages().filter((existing) => existing.path !== entry.path),
  ].slice(0, MAX_ENTRIES);
  writeLocalStorageItem(STORAGE_KEY, JSON.stringify(next));
}
