import type { WorldTemplate } from "@/shared/worldTemplateSchema";

// ---------------------------------------------------------------------------
// Dry-run report — computed entirely in the browser before committing.
// ---------------------------------------------------------------------------

export type DryRunReport = {
  /** Counts of each entity type. */
  readonly counts: {
    readonly resourceCategories: number;
    readonly educationLevels: number;
    readonly cultures: number;
    readonly religions: number;
    readonly resources: number;
    readonly jobs: number;
    readonly blueprints: number;
    readonly blueprintTiers: number;
    readonly depositTypes: number;
    readonly managedPopulationTypes: number;
    readonly unitTypes: number;
    readonly namesets: number;
  };
  /**
   * Dangling cross-references found in the template.
   * Each entry is a human-readable description of the bad ref.
   */
  readonly danglingRefs: readonly string[];
  /** Non-blocking issues worth surfacing to the importer. */
  readonly warnings: readonly string[];
};

export function computeDryRunReport(template: WorldTemplate): DryRunReport {
  const resourceSlugs = new Set(template.resources.map((r) => r.slug));
  const jobSlugs = new Set(template.jobs.map((j) => j.slug));
  const jobsBySlug = new Map(template.jobs.map((j) => [j.slug, j]));
  const resourceCategoryNames = new Set(
    template.resource_categories.map((c) => c.name),
  );
  const educationLevelNames = new Set(
    template.education_levels.map((l) => l.name),
  );
  const blueprintsBySlug = new Map(template.blueprints.map((b) => [b.slug, b]));

  const danglingRefs: string[] = [];
  const warnings: string[] = [];

  // Check resource categories
  for (const resource of template.resources) {
    if (
      resource.category !== null &&
      !resourceCategoryNames.has(resource.category)
    ) {
      danglingRefs.push(
        `Resource "${resource.slug}" references unknown category "${resource.category}"`,
      );
    }
  }

  // Check job inputs / outputs / education level
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
    if (
      job.required_education_level !== null &&
      !educationLevelNames.has(job.required_education_level)
    ) {
      danglingRefs.push(
        `Job "${job.slug}" references unknown education level "${job.required_education_level}"`,
      );
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
        } else if (effect.type === "education") {
          const teacherJob = jobsBySlug.get(effect.teacher_job_slug);
          if (teacherJob === undefined) {
            danglingRefs.push(
              `Blueprint "${bp.slug}" tier ${tier.tier_number} education effect references unknown job "${effect.teacher_job_slug}"`,
            );
          } else if (teacherJob.job_type !== "teacher") {
            danglingRefs.push(
              `Blueprint "${bp.slug}" tier ${tier.tier_number} education effect job "${effect.teacher_job_slug}" is not a teacher job`,
            );
          }
          for (const level of effect.levels) {
            if (
              level.from_level !== null &&
              !educationLevelNames.has(level.from_level)
            ) {
              danglingRefs.push(
                `Blueprint "${bp.slug}" tier ${tier.tier_number} education effect references unknown education level "${level.from_level}"`,
              );
            }
            if (!educationLevelNames.has(level.to_level)) {
              danglingRefs.push(
                `Blueprint "${bp.slug}" tier ${tier.tier_number} education effect references unknown education level "${level.to_level}"`,
              );
            }
          }
        }
      }
    }
  }

  // Check deposit types
  for (const dt of template.deposit_types) {
    for (const job of dt.jobs) {
      if (!jobSlugs.has(job.job_slug)) {
        danglingRefs.push(
          `Deposit type "${dt.slug}" references unknown job "${job.job_slug}"`,
        );
      }
      for (const wi of job.worker_inputs) {
        if (!resourceSlugs.has(wi.resource_slug)) {
          danglingRefs.push(
            `Deposit type "${dt.slug}" worker input references unknown resource "${wi.resource_slug}"`,
          );
        }
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

  // Check unit types
  for (const unit of template.unit_types) {
    if (
      unit.required_education_level !== null &&
      !educationLevelNames.has(unit.required_education_level)
    ) {
      danglingRefs.push(
        `Unit type "${unit.name}" references unknown education level "${unit.required_education_level}"`,
      );
    }
    if (unit.required_building !== null) {
      const blueprint = blueprintsBySlug.get(
        unit.required_building.blueprint_slug,
      );
      if (blueprint === undefined) {
        danglingRefs.push(
          `Unit type "${unit.name}" references unknown blueprint "${unit.required_building.blueprint_slug}"`,
        );
      } else if (
        !blueprint.tiers.some(
          (t) => t.tier_number === unit.required_building?.tier_number,
        )
      ) {
        danglingRefs.push(
          `Unit type "${unit.name}" references unknown tier ${unit.required_building.tier_number} of blueprint "${unit.required_building.blueprint_slug}"`,
        );
      }
    }
    for (const cost of unit.recruitment_costs) {
      if (!resourceSlugs.has(cost.resource_slug)) {
        danglingRefs.push(
          `Unit type "${unit.name}" recruitment cost references unknown resource "${cost.resource_slug}"`,
        );
      }
    }
    for (const cost of unit.upkeep_costs) {
      if (!resourceSlugs.has(cost.resource_slug)) {
        danglingRefs.push(
          `Unit type "${unit.name}" upkeep cost references unknown resource "${cost.resource_slug}"`,
        );
      }
    }
  }

  // Warn when natural_born_percent values sum over 100
  const totalNaturalBornPercent = template.education_levels.reduce(
    (sum, level) => sum + level.natural_born_percent,
    0,
  );
  if (totalNaturalBornPercent > 100) {
    warnings.push(
      `Education level natural_born_percent values sum to ${totalNaturalBornPercent}, which is over 100`,
    );
  }

  return {
    counts: {
      resourceCategories: template.resource_categories.length,
      educationLevels: template.education_levels.length,
      cultures: template.cultures.length,
      religions: template.religions.length,
      resources: template.resources.length,
      jobs: template.jobs.length,
      blueprints: template.blueprints.length,
      blueprintTiers,
      depositTypes: template.deposit_types.length,
      managedPopulationTypes: template.managed_population_types.length,
      unitTypes: template.unit_types.length,
      namesets: template.namesets.length,
    },
    danglingRefs,
    warnings,
  };
}
