import type { WorldTemplate } from "@/shared/worldTemplateSchema";

// ---------------------------------------------------------------------------
// Dry-run report — computed entirely in the browser before committing.
// ---------------------------------------------------------------------------

export type DryRunReport = {
  /** Counts of each entity type. */
  readonly counts: {
    readonly resources: number;
    readonly jobs: number;
    readonly blueprints: number;
    readonly blueprintTiers: number;
    readonly depositTypes: number;
    readonly managedPopulationTypes: number;
    readonly namesets: number;
  };
  /**
   * Dangling cross-references found in the template.
   * Each entry is a human-readable description of the bad ref.
   */
  readonly danglingRefs: readonly string[];
};

export function computeDryRunReport(template: WorldTemplate): DryRunReport {
  const resourceSlugs = new Set(template.resources.map((r) => r.slug));
  const jobSlugs = new Set(template.jobs.map((j) => j.slug));

  const danglingRefs: string[] = [];

  // Check job inputs / outputs
  for (const job of template.jobs) {
    for (const io of job.inputs) {
      if (!resourceSlugs.has(io.resource_slug)) {
        danglingRefs.push(
          `Job "${job.slug}" input references unknown resource "${io.resource_slug}"`,
        );
      }
    }
    for (const io of job.outputs) {
      if (!resourceSlugs.has(io.resource_slug)) {
        danglingRefs.push(
          `Job "${job.slug}" output references unknown resource "${io.resource_slug}"`,
        );
      }
    }
  }

  // Check blueprint tiers
  let blueprintTiers = 0;
  for (const bp of template.blueprints) {
    blueprintTiers += bp.tiers.length;
    for (const tier of bp.tiers) {
      for (const cost of tier.construction_costs) {
        if (!resourceSlugs.has(cost.resource_slug)) {
          danglingRefs.push(
            `Blueprint "${bp.slug}" tier ${tier.tier_number} construction cost references unknown resource "${cost.resource_slug}"`,
          );
        }
      }
      for (const cost of tier.upkeep_costs) {
        if (!resourceSlugs.has(cost.resource_slug)) {
          danglingRefs.push(
            `Blueprint "${bp.slug}" tier ${tier.tier_number} upkeep cost references unknown resource "${cost.resource_slug}"`,
          );
        }
      }
      for (const effect of tier.effects) {
        if (
          effect.type === "passive_resource_production" ||
          effect.type === "resource_storage_increase"
        ) {
          if (!resourceSlugs.has(effect.resource_slug)) {
            danglingRefs.push(
              `Blueprint "${bp.slug}" tier ${tier.tier_number} effect references unknown resource "${effect.resource_slug}"`,
            );
          }
        } else if (effect.type === "job_capacity_increase") {
          if (!jobSlugs.has(effect.job_slug)) {
            danglingRefs.push(
              `Blueprint "${bp.slug}" tier ${tier.tier_number} effect references unknown job "${effect.job_slug}"`,
            );
          }
        }
      }
    }
  }

  // Check deposit types
  for (const dt of template.deposit_types) {
    if (!jobSlugs.has(dt.job_slug)) {
      danglingRefs.push(
        `Deposit type "${dt.slug}" references unknown job "${dt.job_slug}"`,
      );
    }
    for (const wi of dt.worker_inputs) {
      if (!resourceSlugs.has(wi.resource_slug)) {
        danglingRefs.push(
          `Deposit type "${dt.slug}" worker input references unknown resource "${wi.resource_slug}"`,
        );
      }
    }
  }

  // Check managed population types
  for (const m of template.managed_population_types) {
    if (!jobSlugs.has(m.husbandry_job_slug)) {
      danglingRefs.push(
        `Managed pop type "${m.slug}" husbandry_job_slug references unknown job "${m.husbandry_job_slug}"`,
      );
    }
    if (!jobSlugs.has(m.culling_job_slug)) {
      danglingRefs.push(
        `Managed pop type "${m.slug}" culling_job_slug references unknown job "${m.culling_job_slug}"`,
      );
    }
    for (const rule of m.maintenance_rules) {
      if (!resourceSlugs.has(rule.resource_slug)) {
        danglingRefs.push(
          `Managed pop type "${m.slug}" maintenance rule references unknown resource "${rule.resource_slug}"`,
        );
      }
    }
    for (const out of m.culling_outputs) {
      if (!resourceSlugs.has(out.resource_slug)) {
        danglingRefs.push(
          `Managed pop type "${m.slug}" culling output references unknown resource "${out.resource_slug}"`,
        );
      }
    }
    for (const out of m.regular_outputs) {
      if (!resourceSlugs.has(out.resource_slug)) {
        danglingRefs.push(
          `Managed pop type "${m.slug}" regular output references unknown resource "${out.resource_slug}"`,
        );
      }
    }
  }

  return {
    counts: {
      resources: template.resources.length,
      jobs: template.jobs.length,
      blueprints: template.blueprints.length,
      blueprintTiers,
      depositTypes: template.deposit_types.length,
      managedPopulationTypes: template.managed_population_types.length,
      namesets: template.namesets.length,
    },
    danglingRefs,
  };
}
