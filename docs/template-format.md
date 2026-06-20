# World Template Format

Specification for the JSON object exported by the `export-world-template` edge
function and imported by the `import_world_from_template` RPC.

---

## Overview

A world template captures the **configuration** of a world — the game rules,
entity types, and tuneable parameters — but not its **live state**. It is a
portable, slug-based description that can be used to create a fresh world with
the same rules as an existing one.

Templates are produced by calling the `export-world-template` edge function
(POST, world admin or superadmin required) and consumed by the
`import_world_from_template` RPC (superadmin only, via the world creation flow).

---

## Versioning

| Field              | Value         |
| ------------------ | ------------- |
| `template_version` | `1` (integer) |

`template_version` is the first field validated by
`import_world_from_template`. Version 1 is the only supported version. A
template without `template_version: 1` will be rejected by the RPC.

The `meta.exported_at` ISO timestamp records when the template was produced. It
is informational only and is not validated on import.

---

## Top-level structure

```jsonc
{
  "template_version": 1,
  "meta": { "name": "…", "slug": "…", "exported_at": "…" },
  "calendar": {
    /* opaque — world calendar config JSON */
  },
  "population_rules": {
    /* 10 numeric params */
  },
  "npc_flavor": {
    /* opaque — NPC flavor config JSON */
  },
  "naming_config": {
    /* opaque — naming config JSON */
  },
  "namesets": [
    /* array */
  ],
  "resources": [
    /* array */
  ],
  "jobs": [
    /* array */
  ],
  "blueprints": [
    /* array */
  ],
  "deposit_types": [
    /* array */
  ],
  "managed_population_types": [
    /* array */
  ],
}
```

---

## Sections

### `meta`

```jsonc
{
  "name": "Verdant Reach",
  "slug": "verdant-reach",
  "exported_at": "2026-06-20T00:00:00.000Z",
}
```

`name` and `slug` come from the source world row. On import the caller supplies
a new `p_name`; the slug is not re-used — a fresh slug is derived from the new
name.

### `population_rules`

```jsonc
{
  "fertility_chance": 0.03,
  "food_consumption_per_citizen": 1.0,
  "homelessness_decline_rate": 0.1,
  "incest_prevention_depth": 3,
  "maximum_fertility_age_turns": null,
  "minimum_partnership_age_turns": 18,
  "mourning_period_turns": 6,
  "partnership_seek_chance": 0.15,
  "starvation_severity_multiplier": 1.0,
  "water_consumption_per_citizen": 1.0,
}
```

All fields are required on import. `maximum_fertility_age_turns` may be `null`
(no age cap).

### `resources`

```jsonc
[
  {
    "name": "Grain",
    "slug": "grain",
    "base_stockpile_cap": 500,
    "decay_rate": 0.02,
    "is_system_resource": false,
  },
]
```

Trashed resources (`is_trashed: true` in the DB) are excluded from the export.
System resources (`is_system_resource: true`) are included and will be
re-created on import.

### `jobs`

```jsonc
[
  {
    "name": "Farmer",
    "slug": "farmer",
    "job_type": "standard",
    "base_capacity": 10,
    "trader_capacity_per_worker": null,
    "inputs": [{ "resource_slug": "water", "amount_per_worker": 0.5 }],
    "outputs": [{ "resource_slug": "grain", "amount_per_worker": 2.0 }],
  },
]
```

Trashed jobs are excluded. Cross-references use `resource_slug` (not IDs).
The importer remaps slugs to fresh UUIDs.

### `blueprints`

```jsonc
[
  {
    "name": "Farm",
    "slug": "farm",
    "description": null,
    "max_instances_per_settlement": 3,
    "grace_period_turns": 2,
    "tiers": [
      {
        "tier_number": 1,
        "worker_turns_required": 20,
        "construction_costs": [{ "resource_slug": "wood", "amount": 10 }],
        "upkeep_costs": [{ "resource_slug": "grain", "amount": 1 }],
        "effects": [
          {
            "type": "job_capacity_increase",
            "job_slug": "farmer",
            "amount": 5,
          },
          { "type": "population_cap_increase", "amount": 10 },
        ],
      },
    ],
  },
]
```

Trashed blueprints are excluded. Effect types:

- `job_capacity_increase` — cross-references `job_slug`
- `passive_resource_production` — cross-references `resource_slug`
- `resource_storage_increase` — cross-references `resource_slug`
- `population_cap_increase` — no cross-reference

### `deposit_types`

```jsonc
[
  {
    "name": "Iron Vein",
    "slug": "iron-vein",
    "job_slug": "miner",
    "output_units_per_worker": 3.0,
    "worker_inputs": [{ "resource_slug": "water", "amount_per_worker": 0.5 }],
  },
]
```

Trashed deposit types excluded. Cross-references use slugs.

### `managed_population_types`

```jsonc
[
  {
    "name": "Sheep",
    "slug": "sheep",
    "husbandry_job_slug": "shepherd",
    "culling_job_slug": "butcher",
    "husbandry_workers_per_n_animals": 5,
    "growth_rate": 0.04,
    "maintenance_rules": [
      { "resource_slug": "water", "amount_per_n_animals": 0.5 },
    ],
    "culling_outputs": [
      { "resource_slug": "meat", "amount_per_n_animals": 1.0 },
    ],
    "regular_outputs": [
      { "resource_slug": "wool", "amount_per_n_animals": 0.5 },
    ],
  },
]
```

### `namesets`, `calendar`, `npc_flavor`, `naming_config`

These sections are exported verbatim from the source world's JSON config columns
and imported as-is. Their internal structure is opaque to the template format —
they are validated only by the world's application-level config validators, not
by the import RPC.

---

## What is excluded

The following are **not** included in a template and are not restored on import:

- Nations, settlements, citizens, partnerships
- Stockpiles, assignments, construction projects
- Turn history, turn log entries, snapshots
- Notifications, events, event groups
- Trade routes
- World admin grants
- The `current_turn_number` (always starts at 0 for a new world)

---

## Import behaviour

`import_world_from_template` (`supabase/migrations/…_import_world_from_template.sql`):

1. Validates `template_version = 1`.
2. Creates a new `worlds` row with the caller-supplied `p_name` and `p_visibility`.
3. Inserts config entities in dependency order:
   `world → namesets → resources → jobs → blueprints → deposit_types → managed_population_types`
4. Cross-references are remapped: each slug is resolved to the newly-inserted
   UUID. Slugs not present in the template are rejected.
5. The entire operation is wrapped in a transaction — any failure rolls back all
   inserts.

Security: `SECURITY DEFINER`, superadmin-only (checked at function entry).

---

## Compatibility policy

- Templates with `template_version: 1` are supported indefinitely on the current
  schema.
- If a future schema change makes a version-1 template unimportable, a migration
  must increment `template_version` and update this document.
- `is_trashed` entities are not exported; importing a template always produces
  clean (non-trashed) config.
