import type { GubernatorSupabaseClient } from "@/lib/supabase";
import type { WorldTemplate } from "@/shared/worldTemplateSchema";

/**
 * Generates starter topology (nations, settlements, citizens) for a freshly
 * imported world. Called after `import_world_from_template` has succeeded.
 * Receives an authenticated client and the new world's UUID.
 */
export type TopologyGenerator = (
  client: GubernatorSupabaseClient,
  worldId: string,
) => Promise<void>;

/**
 * A bundled scenario: a validated template paired with a topology generator
 * that populates the world with nations, settlements, and initial citizens.
 * The `template` itself must contain zero runtime entities (no nations,
 * settlements, or citizens); those come exclusively from `generateTopology`.
 */
export type BundledScenario = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly template: WorldTemplate;
  readonly generateTopology: TopologyGenerator;
};
