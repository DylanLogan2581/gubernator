// Pure assembly: raw DB data → world template output.
// No zod, no @/ imports, no browser APIs.

import type {
  RawEducationTierLevelRow,
  RawTierEffectRow,
  TierEffectOutput,
  WorldConfigData,
  WorldTemplateOutput,
} from "./types.ts";

/**
 * Derives a URL-friendly world slug from name + UUID, matching the app's
 * createWorldSlug logic in src/features/worlds/utils/worldDisplay.ts.
 */
function deriveWorldSlug(name: string, id: string): string {
  const normalizedName = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
  const normalizedId = id.replaceAll("-", "").slice(0, 8);
  const slugBase = normalizedName === "" ? "world" : normalizedName;
  return `${slugBase}-${normalizedId}`;
}

function resolveEducationTierLevel(
  level: RawEducationTierLevelRow,
  eduNameById: ReadonlyMap<string, string>,
):
  | { readonly from_level: string | null; readonly to_level: string; readonly turns: number }
  | null {
  if (level.from_level_id !== null) {
    const fromLevel = eduNameById.get(level.from_level_id);
    if (fromLevel === undefined) return null;
    const toLevel = eduNameById.get(level.to_level_id);
    if (toLevel === undefined) return null;
    return { from_level: fromLevel, to_level: toLevel, turns: level.turns };
  }
  const toLevel = eduNameById.get(level.to_level_id);
  if (toLevel === undefined) return null;
  return { from_level: null, to_level: toLevel, turns: level.turns };
}

function resolveTierEffect(
  effect: RawTierEffectRow,
  resourceSlugById: ReadonlyMap<string, string>,
  jobSlugById: ReadonlyMap<string, string>,
  eduNameById: ReadonlyMap<string, string>,
): TierEffectOutput | null {
  if (effect.type === "population_cap_increase") {
    return { type: "population_cap_increase", amount: effect.amount };
  }
  if (effect.type === "job_capacity_increase") {
    const jobSlug = jobSlugById.get(effect.job_id);
    if (jobSlug === undefined) return null;
    return { type: "job_capacity_increase", job_slug: jobSlug, amount: effect.amount };
  }
  if (effect.type === "passive_resource_production") {
    const resourceSlug = resourceSlugById.get(effect.resource_id);
    if (resourceSlug === undefined) return null;
    return {
      type: "passive_resource_production",
      resource_slug: resourceSlug,
      amount: effect.amount,
    };
  }
  if (effect.type === "resource_storage_increase") {
    const resourceSlug = resourceSlugById.get(effect.resource_id);
    if (resourceSlug === undefined) return null;
    return {
      type: "resource_storage_increase",
      resource_slug: resourceSlug,
      amount: effect.amount,
    };
  }
  if (effect.type === "education") {
    const teacherJobSlug = jobSlugById.get(effect.teacher_job_id);
    if (teacherJobSlug === undefined) return null;
    const levels = effect.levels.flatMap((level) => {
      const resolved = resolveEducationTierLevel(level, eduNameById);
      return resolved !== null ? [resolved] : [];
    });
    return {
      type: "education",
      teacher_job_slug: teacherJobSlug,
      teacher_capacity: effect.teacher_capacity,
      students_per_teacher: effect.students_per_teacher,
      levels,
    };
  }
  return null;
}

/**
 * Assembles a world template from raw DB rows.
 *
 * Cross-references (UUIDs) are resolved to stable slug keys. Items with
 * unresolvable references are silently dropped. All top-level arrays are
 * already ordered by the query (slug asc); sub-arrays preserve DB order,
 * which is stable for a given world state. The output is therefore
 * deterministic (byte-stable) for the same world snapshot.
 */
export function assembleWorldTemplate(data: WorldConfigData): WorldTemplateOutput {
  // Build lookup maps for slug/name resolution
  const categoryNameById = new Map<string, string>(
    data.resourceCategories.map((c) => [c.id, c.name]),
  );

  const eduNameById = new Map<string, string>(
    data.educationLevels.map((e) => [e.id, e.name]),
  );

  const resourceSlugById = new Map<string, string>(
    data.resources
      .filter((r) => !r.is_trashed)
      .map((r) => [r.id, r.slug]),
  );

  const jobSlugById = new Map<string, string>(
    data.jobs
      .filter((j) => !j.is_trashed)
      .map((j) => [j.id, j.slug]),
  );

  const blueprintSlugById = new Map<string, string>(
    data.blueprints
      .filter((b) => !b.is_trashed)
      .map((b) => [b.id, b.slug]),
  );

  // Resource categories (sorted by sort_order asc, name asc from query)
  const resourceCategories = data.resourceCategories.map((c) => ({
    name: c.name,
    color: c.color,
    sort_order: c.sort_order,
  }));

  // Education levels (sorted by rank asc from query)
  const educationLevels = data.educationLevels.map((e) => ({
    name: e.name,
    description: e.description,
    rank: e.rank,
    natural_born_percent: e.natural_born_percent,
  }));

  // Cultures / religions (sorted by name asc from query)
  const cultures = data.cultures.map((c) => ({
    name: c.name,
    description: c.description,
    color: c.color,
  }));

  const religions = data.religions.map((r) => ({
    name: r.name,
    description: r.description,
    color: r.color,
  }));

  // Resources (non-trashed, sorted by slug asc from query)
  const resources = data.resources
    .filter((r) => !r.is_trashed)
    .map((r) => ({
      name: r.name,
      slug: r.slug,
      base_stockpile_cap: r.base_stockpile_cap,
      change_amount: r.change_amount,
      change_mode: r.change_mode,
      is_system_resource: r.is_system_resource,
      icon: r.icon,
      icon_color: r.icon_color,
      category: r.category_id === null ? null : categoryNameById.get(r.category_id) ?? null,
    }));

  // Jobs (non-trashed, sorted by slug asc from query)
  const jobs = data.jobs
    .filter((j) => !j.is_trashed)
    .map((j) => ({
      name: j.name,
      slug: j.slug,
      job_type: j.job_type,
      base_capacity: j.base_capacity,
      trader_capacity_per_worker: j.trader_capacity_per_worker,
      inputs: j.inputs_json.flatMap((io) => {
        const resourceSlug = resourceSlugById.get(io.resource_id);
        if (resourceSlug === undefined) return [];
        const entry: { resource_slug: string; amount_per_worker: number; notes?: string } = {
          resource_slug: resourceSlug,
          amount_per_worker: io.amount_per_worker,
        };
        if (io.notes !== undefined) entry.notes = io.notes;
        return [entry];
      }),
      outputs: j.outputs_json.flatMap((io) => {
        const resourceSlug = resourceSlugById.get(io.resource_id);
        if (resourceSlug === undefined) return [];
        const entry: { resource_slug: string; amount_per_worker: number; notes?: string } = {
          resource_slug: resourceSlug,
          amount_per_worker: io.amount_per_worker,
        };
        if (io.notes !== undefined) entry.notes = io.notes;
        return [entry];
      }),
      icon: j.icon,
      icon_color: j.icon_color,
      required_education_level: j.required_education_level_id === null
        ? null
        : eduNameById.get(j.required_education_level_id) ?? null,
    }));

  // Blueprints (non-trashed, sorted by slug asc from query)
  // Tiers are embedded in the blueprint row and sorted by tier_number from query
  const blueprints = data.blueprints
    .filter((b) => !b.is_trashed)
    .map((b) => ({
      name: b.name,
      slug: b.slug,
      description: b.description,
      max_instances_per_settlement: b.max_instances_per_settlement,
      grace_period_turns: b.grace_period_turns,
      tiers: [...b.building_blueprint_tiers]
        .sort((a, z) => a.tier_number - z.tier_number)
        .map((t) => ({
          tier_number: t.tier_number,
          worker_turns_required: t.worker_turns_required,
          construction_costs: t.construction_costs_json.flatMap((c) => {
            const resourceSlug = resourceSlugById.get(c.resource_id);
            if (resourceSlug === undefined) return [];
            return [{ resource_slug: resourceSlug, amount: c.amount }];
          }),
          upkeep_costs: t.upkeep_costs_json.flatMap((c) => {
            const resourceSlug = resourceSlugById.get(c.resource_id);
            if (resourceSlug === undefined) return [];
            return [{ resource_slug: resourceSlug, amount: c.amount }];
          }),
          effects: t.effects_json.flatMap((e) => {
            const resolved = resolveTierEffect(e, resourceSlugById, jobSlugById, eduNameById);
            return resolved !== null ? [resolved] : [];
          }),
        })),
      icon: b.icon,
      icon_color: b.icon_color,
    }));

  // Deposit types (non-trashed, sorted by slug asc from query)
  const depositTypes = data.depositTypes
    .filter((d) => !d.is_trashed)
    .map((d) => ({
      name: d.name,
      slug: d.slug,
      jobs: d.deposit_type_jobs.flatMap((dtj) => {
        const jobSlug = jobSlugById.get(dtj.job_id);
        if (jobSlug === undefined) return [];
        return [
          {
            job_slug: jobSlug,
            output_units_per_worker: dtj.output_units_per_worker,
            worker_inputs: dtj.worker_inputs_json.flatMap((wi) => {
              const resourceSlug = resourceSlugById.get(wi.resource_id);
              if (resourceSlug === undefined) return [];
              return [{ resource_slug: resourceSlug, amount_per_worker: wi.amount_per_worker }];
            }),
          },
        ];
      }),
      icon: d.icon,
      icon_color: d.icon_color,
    }));

  // Managed population types (non-trashed, sorted by slug asc from query)
  const managedPopulationTypes = data.managedPopulationTypes
    .filter((m) => !m.is_trashed)
    .map((m) => {
      return {
        name: m.name,
        slug: m.slug,
        husbandry_jobs: m.managed_population_husbandry_jobs.flatMap((hj) => {
          const jobSlug = jobSlugById.get(hj.job_id);
          if (jobSlug === undefined) return [];
          return [
            { job_slug: jobSlug, workers_per_n_animals: hj.workers_per_n_animals },
          ];
        }),
        culling_jobs: m.managed_population_culling_jobs.flatMap((cj) => {
          const jobSlug = jobSlugById.get(cj.job_id);
          if (jobSlug === undefined) return [];
          return [
            { job_slug: jobSlug, max_cull_per_worker: cj.max_cull_per_worker },
          ];
        }),
        growth_rate: m.growth_rate,
        maintenance_rules: m.maintenance_rules_json.flatMap((e) => {
          const resourceSlug = resourceSlugById.get(e.resource_id);
          if (resourceSlug === undefined) return [];
          return [{ resource_slug: resourceSlug, amount_per_n_animals: e.amount_per_n_animals }];
        }),
        culling_outputs: m.culling_outputs_json.flatMap((e) => {
          const resourceSlug = resourceSlugById.get(e.resource_id);
          if (resourceSlug === undefined) return [];
          return [{ resource_slug: resourceSlug, amount_per_n_animals: e.amount_per_n_animals }];
        }),
        regular_outputs: m.regular_outputs_json.flatMap((e) => {
          const resourceSlug = resourceSlugById.get(e.resource_id);
          if (resourceSlug === undefined) return [];
          return [{ resource_slug: resourceSlug, amount_per_n_animals: e.amount_per_n_animals }];
        }),
        icon: m.icon,
        icon_color: m.icon_color,
      };
    });

  // Unit types (sorted by name asc from query)
  const unitTypes = data.unitTypes.map((u) => {
    const requiredBlueprintId = u.required_building_blueprint_id;
    const requiredTierNumber = u.required_building_tier_number;
    let requiredBuilding: { readonly blueprint_slug: string; readonly tier_number: number } | null =
      null;
    if (requiredBlueprintId !== null && requiredTierNumber !== null) {
      const blueprintSlug = blueprintSlugById.get(requiredBlueprintId);
      if (blueprintSlug !== undefined) {
        requiredBuilding = { blueprint_slug: blueprintSlug, tier_number: requiredTierNumber };
      }
    }

    return {
      name: u.name,
      description: u.description,
      soldiers_per_unit: u.soldiers_per_unit,
      required_education_level: u.required_education_level_id === null
        ? null
        : eduNameById.get(u.required_education_level_id) ?? null,
      required_building: requiredBuilding,
      recruitment_costs: u.recruitment_costs_json.flatMap((c) => {
        const resourceSlug = resourceSlugById.get(c.resource_id);
        if (resourceSlug === undefined) return [];
        return [{ resource_slug: resourceSlug, amount: c.amount }];
      }),
      upkeep_costs: u.upkeep_costs_json.flatMap((c) => {
        const resourceSlug = resourceSlugById.get(c.resource_id);
        if (resourceSlug === undefined) return [];
        return [{ resource_slug: resourceSlug, amount: c.amount }];
      }),
      desertion_rate: u.desertion_rate,
    };
  });

  // Namesets (non-trashed, sorted by name asc from query)
  const namesets = data.namesets
    .filter((n) => !n.is_trashed)
    .map((n) => ({
      name: n.name,
      is_default: n.is_default,
      config: n.config_json,
    }));

  const { world } = data;
  const slug = deriveWorldSlug(world.name, world.id);

  return {
    template_version: 2,
    meta: {
      name: world.name,
      slug,
      exported_at: data.exportedAt,
    },
    calendar: world.calendar_config_json,
    population_rules: {
      fertility_chance: world.fertility_chance,
      food_consumption_per_citizen: world.food_consumption_per_citizen,
      homelessness_decline_rate: world.homelessness_decline_rate,
      incest_prevention_depth: world.incest_prevention_depth,
      maximum_fertility_age_turns: world.maximum_fertility_age_turns,
      minimum_partnership_age_turns: world.minimum_partnership_age_turns,
      mourning_period_turns: world.mourning_period_turns,
      partnership_seek_chance: world.partnership_seek_chance,
      starvation_severity_multiplier: world.starvation_severity_multiplier,
      water_consumption_per_citizen: world.water_consumption_per_citizen,
    },
    npc_flavor: world.npc_flavor_config_json,
    naming_config: world.naming_config_json,
    namesets,
    resource_categories: resourceCategories,
    education_levels: educationLevels,
    cultures,
    religions,
    resources,
    jobs,
    blueprints,
    deposit_types: depositTypes,
    managed_population_types: managedPopulationTypes,
    unit_types: unitTypes,
  };
}
