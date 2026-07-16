import {
  worldGeneratedNamingConfigSchema,
  type WorldGeneratedNamingConfig,
} from "@/lib/worldNamingConfigSchemas";

import libraryIndexRaw from "./index.json";

export type NamesetLibraryIndexEntry = {
  readonly id: string;
  readonly displayName: string;
  readonly category: string;
};

// Populated by `node --experimental-strip-types ./scripts/scrape-fng/run.ts`,
// which crawls fantasynamegenerators.com and writes one JSON definition per
// generator alongside this eager index.
export const namesetLibraryIndex: readonly NamesetLibraryIndexEntry[] =
  libraryIndexRaw;

// One lazy chunk per definition file, so the library never loads eagerly
// into the app bundle.
const definitionLoaders = import.meta.glob<{ default: unknown }>("./*.json");

export async function loadNamesetLibraryDefinition(
  id: string,
): Promise<WorldGeneratedNamingConfig | null> {
  const loader = definitionLoaders[`./${id}.json`];
  if (loader === undefined) return null;
  const definitionModule = await loader();
  const raw = definitionModule.default;
  if (typeof raw !== "object" || raw === null || !("config" in raw)) {
    return null;
  }
  const parsed = worldGeneratedNamingConfigSchema.safeParse(raw.config);
  return parsed.success ? parsed.data : null;
}
