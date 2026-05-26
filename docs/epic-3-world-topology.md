# Epic 3: World Topology and Roles

Short reference for how player-character context, role scoping, hidden nations, partnerships, and citizen lifecycle fit together. Mirrors the Epic 1 docs added in PR #41.

This file is a quick map of how the pieces interact and where they live in the codebase. It does not duplicate the Epic 3 feature guide or schema plan — those remain the source of truth for product behavior and table shape. The canonical schema lives in the `supabase/migrations/2026052*` and `2026051900000[1-3]*` files; the canonical UI behavior lives in the modules listed under "Code locations" below.

## Role hierarchy

Authority over a world is layered. Higher roles always include the lower roles' authority.

1. **Super Admin** — global Gubernator administrator. Bypasses RLS for every world via `public.is_super_admin()`.
2. **World Admin** — owner or explicit `world_admins` row holder for a specific world. Resolved via `public.is_world_admin(world_id)`.
3. **Nation Manager** — held by a living `player_character` citizen whose `role_type = 'nation_manager'` and `role_nation_id` is set. Resolved via `public.is_nation_manager_of(nation_id)` (and the composable `public.current_user_manages_nation(nation_id)`).
4. **Settlement Manager** — held by a living `player_character` citizen whose `role_type = 'settlement_manager'` and `role_settlement_id` is set. Resolved via `public.is_settlement_manager_of(settlement_id)` (and the composable `public.current_user_manages_settlement(settlement_id)`).
5. **Player Character (no role)** — any user controlling at least one living `player_character` in the world. Resolved via `public.user_has_player_character_in_world(world_id)`.

Roles are attached to a citizen row, not directly to a user. A user holds a role only while the linked `player_character` is alive. The role columns (`role_type`, `role_nation_id`, `role_settlement_id`) and the `user_id` link column are unreachable through the table API — column-level grants block direct `INSERT`/`UPDATE`, and all mutations route through the `assign_citizen_role`, `revoke_citizen_role`, and character-link RPCs.

## World entry decision tree

Implemented in `src/features/worlds/components/WorldEntryGate.tsx`. The gate runs at the world route boundary and decides what to render before any world content mounts:

1. **Session unresolved** — show loading; if the session fetch errors, show an error state.
2. **Authenticated but inactive app user** — show "Account access unavailable". Authenticated users with no session are handled by the parent route's auth guard.
3. **Not authenticated** — fall through to children; sub-screens render their own access-denied states once the route guard completes.
4. **World inaccessible** — show "World unavailable" (covers both nonexistent worlds and worlds the caller cannot reach).
5. **World accessible, no selectable player character**
   - World admin path → admin direct entry (no active PC).
   - Otherwise → "No character in this world".
6. **World accessible, exactly one selectable player character** → auto-select that PC and enter.
7. **World accessible, multiple selectable player characters**
   - If a persisted `user_active_player_characters` row still resolves to a selectable PC → resume that selection and enter.
   - Otherwise → render `PlayerCharacterChooser` inline at the world URL so deep links to the destination survive selection.

The chooser is mounted at the same URL as the destination so the existing route's deep link is preserved across selection. Once selection succeeds, the same gate re-evaluates and the destination renders.

## Citizen visibility: DB vs UI

The database is intentionally broad so Nation/Settlement Managers and player characters can compute aggregate counts and statistics across their scope. Per-citizen detail is restricted in the UI layer, not in RLS.

### DB (read RLS on `public.citizens`)

A citizen row is `SELECT`-visible when **any** of the following holds for the current session:

- caller is a Super Admin
- caller is a World Admin of the citizen's world
- caller is the Nation Manager of the citizen's settlement's nation
- caller is the Settlement Manager of the citizen's settlement
- caller controls at least one living `player_character` in the citizen's world

### UI (per-role surface)

| Role                  | Citizens list (settlement) | Citizen detail                                            | Role assignment surface                                   |
| --------------------- | -------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| Super Admin           | Full per-citizen list      | Full detail                                               | Full (citizen detail + nation detail Settlement Manager). |
| World Admin           | Full per-citizen list      | Full detail                                               | Full (citizen detail + nation detail Settlement Manager). |
| Nation Manager        | Aggregate counts only      | Redirected to the citizen's settlement detail (read-only) | Settlement Manager only, via the nation detail screen.    |
| Settlement Manager    | Aggregate counts only      | Redirected to the citizen's settlement detail (read-only) | None.                                                     |
| Player Character only | Aggregate counts only      | Own living character only (own row, editable subset)      | None.                                                     |

The redirect for Nation/Settlement Managers off the citizen detail screen is implemented in `CitizenManagerRedirect` in `src/features/citizens/components/CitizenDetailPage.tsx`. Aggregate-only views are implemented in `CitizensAggregateView` in `src/features/citizens/components/CitizensPanel.tsx`.

## Player character self-editable columns

A `player_character` updating their own citizen row via the table API (or the `updateCitizenCore` UI mutation) may only touch the following columns:

| Column              | Notes                                 |
| ------------------- | ------------------------------------- |
| `name`              | Display name.                         |
| `sex`               | Free-text sex field.                  |
| `profile_photo_url` | URL to the character's profile photo. |
| `personality_text`  | Free-text personality description.    |
| `skills_text`       | Free-text skills description.         |

The following columns are **protected** and cannot be changed by a PC directly. Any attempt to update them via the REST API is rejected with SQLSTATE 42501 by the `citizens_update_self` RLS policy:

| Protected column      | Why protected                                                             |
| --------------------- | ------------------------------------------------------------------------- |
| `settlement_id`       | Relocating oneself bypasses Settlement Manager authority.                 |
| `parent_a_citizen_id` | Lineage tampering; bypasses incest-prevention (runs only at creation).    |
| `parent_b_citizen_id` | Same as above.                                                            |
| `status`              | Self-marking dead or self-reviving bypasses admin lifecycle controls.     |
| `born_on_turn_number` | Birth-turn is an immutable audit field.                                   |
| `death_cause`         | Death cause is set only via the admin `markCitizenDead` lifecycle action. |

Admins (Super Admin, World Admin) retain full UPDATE access to all of these columns through the separate `citizens_update_admin` policy.

### Hidden nations

`public.nations.is_hidden` is private to the three privileged paths defined by `public.nation_visible_to_current_user(nation_id)`: Super Admin, World Admin of the nation's world, and any user whose living `player_character`'s settlement belongs to the nation. The non-hidden + world-access path layers on top of that helper, so the `is_hidden` flag itself never leaks to unprivileged readers.

## Partnership lifecycle ownership across epics

Partnerships are persistent history rows on `public.partnerships`. Active partnerships are unique per citizen via paired partial unique indexes; ended partnerships keep their row with a non-null `ended_on_turn_number` and a terminal `status` (`dissolved` | `widowed`).

| Epic       | Owner                                | Write path                                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Epic 3** | Admin-only (manual, operator-driven) | World Admin / Super Admin via the dedicated partnership mutation RPCs (`form_partnership`, `dissolve_partnership`, etc.). Operator is recorded on `changed_by_user_id`, with a free-text `change_reason`. A paired turn log entry is written by the data layer. |
| **Epic 6** | Simulation engine (system-driven)    | A dedicated SECURITY DEFINER mutation surface owned by the simulation. Direct admin writes continue to exist; simulation writes are layered on top of the same table.                                                                                           |

Read RLS on partnerships mirrors citizen read visibility: a partnership is visible if either participant citizen is visible. The schema and Epic 3 write path live in `supabase/migrations/20260520000002_add_partnerships.sql` and `supabase/migrations/20260522000003_add_partnership_mutations.sql`.

## Code locations

| Concern                                | Path                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Permission helpers (RLS, SQL)          | `supabase/migrations/20260522000001_extend_rls_permission_helpers.sql`       |
| Original permission helpers            | `supabase/migrations/20260426000002_permission_helpers.sql`                  |
| Citizens schema and RLS                | `supabase/migrations/20260520000000_add_citizens.sql`                        |
| Citizens self-edit restriction         | `supabase/migrations/20260525000000_restrict_citizen_self_update.sql`        |
| Partnerships schema and RLS            | `supabase/migrations/20260520000002_add_partnerships.sql`                    |
| Nation relationships schema and RLS    | `supabase/migrations/20260520000003_add_nation_relationships.sql`            |
| Active PC table and cleanup triggers   | `supabase/migrations/20260520000004_add_user_active_player_characters.sql`   |
| Role / character-link mutations        | `supabase/migrations/20260522000002_add_player_character_role_mutations.sql` |
| Permission feature module              | `src/features/permissions`                                                   |
| Access-context helper (UI)             | `src/features/permissions/utils/accessContext.ts`                            |
| Active player-character context        | `src/features/permissions/context/activePlayerCharacterContext.ts`           |
| Active character switcher              | `src/features/permissions/components/ActiveCharacterSwitcher.tsx`            |
| Role assignment controls               | `src/features/permissions/components/RoleAssignmentControls.tsx`             |
| World entry gate                       | `src/features/worlds/components/WorldEntryGate.tsx`                          |
| Citizens panel (admin vs aggregate UI) | `src/features/citizens/components/CitizensPanel.tsx`                         |
| Citizen detail + manager redirect      | `src/features/citizens/components/CitizenDetailPage.tsx`                     |
| Partnership history panel              | `src/features/citizens/components/PartnershipHistoryPanel.tsx`               |

## Related docs

- [`AGENTS.md`](../AGENTS.md) — repository instruction file for agents (placement rules, lint expectations, Supabase rules).
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — local Supabase setup, seeded users, validation commands.
- Epic 3 feature guide and schema plan — tracked alongside the Epic 3 GitHub issues; this file references them rather than duplicating their content.
