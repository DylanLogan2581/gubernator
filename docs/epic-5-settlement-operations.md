# Epic 5: Settlement Operations

Short reference for how settlement-scoped resources, construction, buildings, deposits, managed populations, trade routes, and citizen assignments fit together. Companion to `docs/epic-3-world-topology.md`.

This file is a quick map of how the pieces interact and where they live in the codebase. It does not duplicate the Epic 5 feature guide or schema plan — those remain the source of truth for product behavior and table shape. The canonical schema lives in the `supabase/migrations/20260601*` files; the canonical UI behavior lives in the feature modules listed under "Code locations" below.

## Settlement-scoped entity inventory

| Table                            | Brief                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `settlement_resource_stockpiles` | One row per settlement × active resource; tracks current `quantity`. Auto-seeded on settlement or resource insert.                         |
| `construction_projects`          | Planning-time queue of in-flight construction projects for a settlement; one active `queue_position` per non-terminal project.             |
| `settlement_buildings`           | Active building instances in a settlement. Derived from completed construction projects; contributes to `population_cap` and job capacity. |
| `deposit_instances`              | Per-settlement deposit registry (one row per discovered deposit).                                                                          |
| `deposit_instance_resources`     | Per-resource mix for a deposit: `initial_quantity` and `remaining_quantity`. Multiple resources per deposit are supported.                 |
| `managed_population_instances`   | Per-settlement herd or flock instance with current count and a configurable cull quantity.                                                 |
| `trade_routes`                   | Standing resource-transfer agreement between two settlements; bilateral approval stored inline; no separate approval table.                |

The world-scoped definition tables (`job_definitions`, `building_blueprints`, `building_blueprint_tiers`, `deposit_types`, `managed_population_types`, `resources`) are referenced by the instance tables above but are not settlement-scoped themselves.

Schema cross-references: `gubernator_schema_simplified_v3.md` §5 (resources), §6 (jobs), §7 (buildings and blueprints), §8 (deposits), §9 (managed populations), §10 (trade routes), §11 (citizen assignments).

## Stockpile direct-edit rule and admin-vs-manager boundary

**SELECT** is open to any user with world access (owner, world admin, Nation Manager PC, Settlement Manager PC, any player character in the world).

**INSERT / UPDATE / DELETE** via the table API requires World Admin or Super Admin. Nation Managers and Settlement Managers are intentionally excluded from direct stockpile writes; their mutations route through the `get_settlement_stockpiles` view and the stockpile RPC surface (Card 8).

Column-level grants restrict direct mutations further:

- `INSERT` only allows `(id, settlement_id, resource_id, quantity)`.
- `UPDATE` only allows `quantity`. `settlement_id` and `resource_id` are INSERT-only and cannot be relocated after creation.

The `authenticated` role has all other stockpile columns revoked. The auto-seed triggers (`settlements_seed_stockpiles`, `resources_seed_stockpiles`) are `SECURITY DEFINER` so they bypass the admin-only insert policy when fired by a non-admin caller (e.g. a service-role world-creation path).

## Construction queue lifecycle

```text
queued → in_progress → paused → in_progress → ...
queued → cancelled
in_progress → complete
in_progress → cancelled
paused → cancelled
```

Projects are created via `create_construction_project(p_settlement_id, p_blueprint_id, p_target_tier_id)`. Authorized callers: anyone who passes `current_user_manages_settlement(p_settlement_id)` — Settlement Manager, Nation Manager of the parent nation, World Admin, or Super Admin.

- A project enters `queued` with the next available `queue_position`.
- The simulation (Epic 6) advances `queued` → `in_progress` and increments `progress_worker_turns` each transition until the tier's required worker-turns are met, at which point the project moves to `complete` and a `settlement_buildings` row is created.
- A shortfall in workers or stockpile inputs causes the simulation to move the project to `paused`; it can be moved back to `in_progress` once resources recover.
- `cancel_construction_project(p_project_id)` moves any non-terminal project to `cancelled` (authorized: `current_user_manages_settlement`).
- `reorder_construction_projects(p_settlement_id, p_ordered_ids)` reassigns `queue_position` values across all non-terminal projects for the settlement.
- The partial unique index `construction_projects_settlement_queue_position_idx` enforces one active position per settlement among non-terminal statuses (`queued`, `in_progress`, `paused`). Completed and cancelled rows are excluded and do not block reordering.
- A BEFORE INSERT trigger (`construction_projects_max_instances`) enforces `building_blueprints.max_instances_per_settlement` across in-flight projects per settlement.

## Settlement buildings state machine and population cap

```text
active ↔ suspended
active → manually_deconstructed   (admin-only RPC)
active → auto_deconstructed       (Epic 6 simulation)
suspended → auto_deconstructed    (Epic 6 simulation)
```

Buildings are created by the Epic 6 turn simulation when a construction project reaches `complete`. Direct `INSERT` and `UPDATE` to `settlement_buildings` is restricted to World Admin / Super Admin.

**Manual deconstruct** is an admin-only operation (`manual_deconstruct_settlement_building(p_settlement_building_id)`). It:

1. Rejects callers who are not Super Admin or World Admin (42501).
2. Rejects buildings already in a terminal state (`auto_deconstructed`, `manually_deconstructed`) with P0001.
3. Sets `state = 'manually_deconstructed'`.
4. Computes the new `population_cap` for the settlement (buildings already marked non-active are excluded).
5. If the new cap is below the current alive-citizen count, writes a `turn_log_entries` row with `log_category = 'manual_deconstruct_overshoot'` for Epic 6's homelessness pass to pick up. `turn_transition_id` is NULL for out-of-band admin entries (column is nullable after migration `20260601000012`).

**Population cap derivation** is computed by `settlement_population_cap(p_settlement_id)` (STABLE SECURITY DEFINER):

- Sums `amount` values from `effects_json` entries where `type = 'population_cap_increase'` across all `active` buildings in the settlement (via `current_tier_id.effects_json`).
- Returns `0` when no active population-cap buildings exist.

**Job capacity derivation** follows the same pattern via `settlement_job_capacity(p_settlement_id, p_job_id)`:

- Base capacity from `job_definitions.base_capacity` (0 if null) plus the sum of `job_capacity_increase` effect amounts filtered to `p_job_id` from active buildings.
- Used by the bulk-count assignment RPCs to enforce the per-job ceiling.

## Deposit instance resource-mix model and depletion semantics

A `deposit_instances` row represents a single discovered deposit at a settlement. Its status values are:

| Status     | Meaning                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ |
| `active`   | Workers can be assigned; depletion may occur each transition.                              |
| `depleted` | All resource reserves have reached zero; no production possible. Set by Epic 6 simulation. |
| `removed`  | Manually removed by an admin via `remove_deposit_instance(p_deposit_instance_id)`.         |

Each deposit carries a resource mix in `deposit_instance_resources` (one row per resource):

- `initial_quantity` — set at creation; immutable after insert; must be positive.
- `remaining_quantity` — decremented by the Epic 6 simulation each transition based on worker output; clamped to `[0, initial_quantity]`.
- The constraint `remaining_quantity <= initial_quantity` is enforced at the DB layer.
- A BEFORE INSERT trigger rejects any `resource_id` that is soft-deleted (`is_trashed = true`).
- A BEFORE INSERT/UPDATE trigger validates that `resource_id` belongs to the same world as the deposit's settlement (via a 4-level join; cannot be expressed as a plain FK).

`max_workers` on the deposit instance is an optional cap. If set, `set_per_target_assignment` rejects a citizen list that exceeds it.

Deposits arrive via admin action (direct insert) or future discovery events (Epic 7, which will add the FK constraint on `discovered_by_event_id`). Nation/Settlement Managers cannot create deposit instances directly.

## Managed population instance lifecycle

Each `managed_population_instances` row represents one herd or flock at a settlement.

| Status    | Meaning                                                                               |
| --------- | ------------------------------------------------------------------------------------- |
| `active`  | Population is alive; husbandry and culling assignments accepted.                      |
| `extinct` | Population has died out. Set by Epic 6 simulation; managers cannot set this directly. |

Key constraints enforced at the DB layer:

- `current_count >= 0`
- `configured_cull_quantity >= 0`
- `configured_cull_quantity <= current_count` — planning-time invariant; Epic 6 must relax or bypass this check during turn resolution if a mid-processing transient state would violate it.

**Write policy split (RLS):**

- **INSERT admin path** — World Admin / Super Admin may insert with any status, including `extinct`.
- **INSERT manager path** — Nation Manager or Settlement Manager may insert, but only with `status = 'active'`.
- **UPDATE admin path** — World Admin / Super Admin may update to any status.
- **UPDATE manager path** — Nation Manager or Settlement Manager may update rows they can access, but the new status must remain `'active'`. Managers cannot mark a population extinct; that transition is reserved for Epic 6.
- **DELETE** — any user who passes `current_user_manages_settlement` (includes World Admin / Super Admin).

## Trade route bilateral approval matrix

A trade route is proposed by one Nation Manager and must be approved by both sides' Nation Managers before resources flow.

**Status values:**

| Status      | Meaning                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| `proposed`  | Created, awaiting bilateral approval.                                   |
| `active`    | Both sides approved; resource transfer occurs each turn transition.     |
| `paused`    | Simulation paused the route due to shortfall; resumes when resolved.    |
| `cancelled` | Either side rejected, or explicitly cancelled via `cancel_trade_route`. |
| `replaced`  | Superseded by a new route via `replace_trade_route`.                    |

**Side approval values** (`origin_approval_status`, `destination_approval_status`):

| Value      | Meaning                                   |
| ---------- | ----------------------------------------- |
| `pending`  | No decision from this side yet.           |
| `approved` | Nation Manager on this side has approved. |
| `rejected` | Nation Manager on this side has rejected. |

**Lifecycle RPCs:**

| RPC                                                                                       | Auth                                     | Effect                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `propose_trade_route(origin, destination, resource_id, quantity, proposed_by_citizen_id)` | Nation Manager on either endpoint nation | Creates row `(status=proposed, both sides=pending)`; fires `trade_proposal_received` notification to managers on both sides (falls back to world admins if no active managers on a side). |
| `approve_trade_route_side(route_id, side, approver_citizen_id)`                           | Nation Manager on the specified side     | Records `approved` for that side. When both sides are `approved`, transitions route to `active` and fires `trade_proposal_accepted` notification.                                         |
| `reject_trade_route_side(route_id, side)`                                                 | Nation Manager on the specified side     | Records `rejected` for that side; route transitions to `cancelled`.                                                                                                                       |
| `cancel_trade_route(route_id)`                                                            | Nation Manager on either side            | Moves `proposed` or `active` route to `cancelled`.                                                                                                                                        |
| `replace_trade_route(route_id, ...)`                                                      | Nation Manager on either side            | Creates a replacement route; marks the existing route `replaced` and links via `replacement_for_trade_route_id`.                                                                          |

**Column-level grant restriction:** `origin_approval_status`, `destination_approval_status`, `origin_approved_by_citizen_id`, `destination_approved_by_citizen_id`, and `status` are not grantable for direct writes via the table API. All approval-lifecycle mutations must go through the SECURITY DEFINER RPCs above.

**Visibility:** A trade route is visible when either endpoint settlement's nation is visible to the caller (via `nation_visible_to_current_user`) or the nation is non-hidden and the caller has world access. This mirrors the `nation_relationships_select_visible` pattern from Epic 3.

**Approval guard:** `approve_trade_route_side` verifies the route is in `proposed` or `paused` status, rejects if the side is already `approved`, and (unless the caller is an admin) checks that the approver citizen belongs to the side's nation.

## Assignment model

Citizens are assigned to work targets via two surfaces:

### Bulk-count (standard jobs and construction projects)

The caller specifies a target headcount, and the RPC adds or removes citizens to reach exactly that count.

| RPC                                                                                         | Target types                                       | Auth                              |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `set_bulk_standard_job_assignment(settlement_id, job_id, target_count, removal_strategy)`   | Standard `job_definitions` (job_type = 'standard') | `current_user_manages_settlement` |
| `set_bulk_construction_assignment(construction_project_id, target_count, removal_strategy)` | Non-terminal `construction_projects`               | `current_user_manages_settlement` |

**Raising** (target > current): only unassigned, alive NPCs from the settlement are picked (ordered by `citizen_id` for determinism). The RPC rejects with P0001 if there are insufficient unassigned NPCs. Player characters cannot be added to bulk-count jobs via these RPCs.

**Standard job ceiling:** `target_count` must not exceed `settlement_job_capacity(p_settlement_id, p_job_id)`. Construction projects have no settlement-wide capacity cap.

### Per-target (deposits, managed populations, trade route ends)

The caller supplies the complete desired list of citizen IDs (`p_citizen_ids`). The RPC atomically replaces the prior assignment state for both the target and the supplied citizens.

```sql
set_per_target_assignment (
  p_settlement_id,
  p_assignment_type, -- 'deposit' | 'husbandry' | 'culling' | 'trade_route'
  p_target_id,
  p_citizen_ids,
  p_trade_route_end -- 'origin' | 'destination' (required for trade_route only)
)
```

Auth: `current_user_manages_settlement(p_settlement_id)` (includes World Admin / Super Admin).

The atomic reassignment is a two-step delete-then-insert within a single transaction:

1. Delete all existing assignments for every citizen in `p_citizen_ids`.
2. Delete all remaining assignments on the specific target (citizens displaced from the target but not in `p_citizen_ids`).
3. Insert new assignments for each citizen in `p_citizen_ids`.

All citizens supplied must be alive members of `p_settlement_id`. Passing an empty `p_citizen_ids` clears all assignments for the target.

### Removal strategy (bulk-count RPCs)

Both `set_bulk_standard_job_assignment` and `set_bulk_construction_assignment` accept a `p_removal_strategy` argument that governs which citizens are removed when the target count is lower than the current count.

| Strategy    | Behaviour                                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npc_first` | Removes NPCs before player characters; stable `citizen_id` tiebreak within each tier. Default choice — preserves player character assignments longest.               |
| `random`    | Deterministic-random within the transaction via `setseed(frac(epoch))`; still preserves the PC-last invariant (citizen_type sort tier precedes the random ordering). |

**Invariant across both strategies:** player characters are always removed last. This is enforced in both removal paths by sorting on `(c.citizen_type = 'player_character')::int asc` before the per-strategy tiebreak.

## Code locations

| Concern                                | Path                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Stockpile table and RLS                | `supabase/migrations/20260601000000_add_settlement_resource_stockpiles.sql`         |
| Stockpile view and RPC (Card 8)        | `supabase/migrations/20260601000008_add_settlement_stockpiles_view_and_rpc.sql`     |
| Construction projects table and RLS    | `supabase/migrations/20260601000001_add_construction_projects.sql`                  |
| Construction project create RPC        | `supabase/migrations/20260601000009_create_construction_project_rpc.sql`            |
| Construction project cancel RPC        | `supabase/migrations/20260601000010_cancel_construction_project_rpc.sql`            |
| Construction project reorder RPC       | `supabase/migrations/20260601000011_reorder_construction_projects_rpc.sql`          |
| Settlement buildings table and RLS     | `supabase/migrations/20260601000002_add_settlement_buildings.sql`                   |
| Manual deconstruct RPC                 | `supabase/migrations/20260601000012_manual_deconstruct_settlement_building_rpc.sql` |
| Deposit instances and resource mix     | `supabase/migrations/20260601000003_add_deposit_instances.sql`                      |
| Create deposit instance RPC            | `supabase/migrations/20260601000013_create_deposit_instance_rpc.sql`                |
| Set deposit instance max workers RPC   | `supabase/migrations/20260601000014_set_deposit_instance_max_workers_rpc.sql`       |
| Remove deposit instance RPC            | `supabase/migrations/20260601000015_remove_deposit_instance_rpc.sql`                |
| Managed population instances           | `supabase/migrations/20260601000004_add_managed_population_instances.sql`           |
| Create managed population instance RPC | `supabase/migrations/20260601000016_create_managed_population_instance_rpc.sql`     |
| Set configured cull quantity RPC       | `supabase/migrations/20260601000017_set_configured_cull_quantity_rpc.sql`           |
| Remove managed population instance RPC | `supabase/migrations/20260601000018_remove_managed_population_instance_rpc.sql`     |
| Trade routes table and RLS             | `supabase/migrations/20260601000005_add_trade_routes.sql`                           |
| Propose trade route RPC                | `supabase/migrations/20260601000019_propose_trade_route_rpc.sql`                    |
| Approve trade route side RPC           | `supabase/migrations/20260601000020_approve_trade_route_side_rpc.sql`               |
| Reject trade route side RPC            | `supabase/migrations/20260601000021_reject_trade_route_side_rpc.sql`                |
| Cancel trade route RPC                 | `supabase/migrations/20260601000022_cancel_trade_route_rpc.sql`                     |
| Replace trade route RPC                | `supabase/migrations/20260601000023_replace_trade_route_rpc.sql`                    |
| Bulk standard job assignment RPC       | `supabase/migrations/20260601000024_set_bulk_standard_job_assignment_rpc.sql`       |
| Bulk construction assignment RPC       | `supabase/migrations/20260601000025_set_bulk_construction_assignment_rpc.sql`       |
| Per-target assignment RPC              | `supabase/migrations/20260601000026_set_per_target_assignment_rpc.sql`              |
| Trade feature module                   | `src/features/trade`                                                                |
| Deposit feature module                 | `src/features/deposits`                                                             |
| Managed populations feature module     | `src/features/managed-populations`                                                  |
| Buildings feature module               | `src/features/buildings`                                                            |
| Citizen assignment board               | `src/features/citizens/components/AssignmentBoard.tsx`                              |

## Related docs

- [`AGENTS.md`](../AGENTS.md) — repository instruction file for agents (placement rules, lint expectations, Supabase rules).
- [`docs/epic-3-world-topology.md`](epic-3-world-topology.md) — role hierarchy, world-entry decision tree, citizen visibility, and partnership lifecycle.
- Epic 5 feature guide and schema plan — tracked alongside the Epic 5 GitHub issues; this file references them rather than duplicating their content.
