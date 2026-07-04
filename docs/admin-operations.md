# Admin Operations Guide

Procedures for superadmin tasks: stuck-transition recovery, world lifecycle
management, data pruning, and user administration.

All operations described here require superadmin access. The superadmin settings
page is at `/superadmin/`.

---

## Stuck-transition recovery

### When to use

A turn transition is stuck when it is in `running` status but the edge function
that started it has already exited (crashed, timed out, or was interrupted after
`start_turn_transition` but before `apply_turn_transition`). The world cannot
advance to the next turn while a transition is in `running` status.

### How to detect

The **Stuck Transitions** panel on `/superadmin/` queries all transitions in
`running` status and shows their world ID, turn range, and start time. A
transition that has been running for more than a few minutes is a candidate for
recovery.

### Recovery procedure

1. Go to `/superadmin/` → **Stuck Transitions**.
2. Identify the stuck transition (world ID, turn `N → N+1`, start time).
3. Click **Recover** on the row.
4. Optionally enter a recovery reason (e.g. `"pre-apply validation bug fixed"`).
   The reason is stored in the transition record for audit purposes.
5. Click **Recover** in the confirmation dialog.

The transition is marked `failed`. The world is unlocked and a fresh end-turn
can be started immediately.

### What this does (and does not do)

- **Does**: calls `fail_stuck_transition(p_transition_id, p_world_id, p_reason)`
  which sets `transitions.status = 'failed'` and clears the world lock.
- **Does not**: roll back any partial writes. If `apply_turn_transition` was
  called and failed mid-way, the database may be in a partially-applied state.
  In practice the RPC is atomic, so partial application is not possible — a
  crash during `apply_turn_transition` leaves the world in its pre-transition
  state.
- **Does not**: re-run the simulation. A fresh end-turn request will re-load
  state and re-plan from scratch.

This operation cannot be undone. If you mark a healthy (slow but still running)
transition as failed, the transition will be abandoned and the world will need to
end turn again.

---

## World lifecycle management

### World status transitions

```
active  ──►  trashed  ──►  (hard deleted)
  ▲              │
  └──────────────┘  (restore)
```

**Archive** (set `archived_at`): worlds can be archived from the world
configuration panel. Archived worlds cannot advance turns. The simulation
rejects runs on archived worlds with a `world_archived` error.

**Trash** (`is_trashed = true`): a soft delete. The world is hidden from normal
listings. Can be restored by a superadmin.

**Hard delete**: permanent cascade delete of the world and all dependent data.
Only available to superadmins. Only applies to trashed worlds.

### Hard-delete procedure

1. First **trash** the world (world settings → delete/trash). This is a
   prerequisite — the hard-delete panel only shows trashed worlds.
2. Go to `/superadmin/` → **World Hard Delete**.
3. Select the world from the dropdown.
4. Click **Preview cascade** — the panel shows counts for all data that will be
   deleted (nations, settlements, citizens, turn transitions, notifications,
   snapshots, log entries, etc.).
5. Review the counts. Click **Delete world** to proceed.
6. Confirm in the dialog.

The deletion uses `hard_delete_world(p_world_id)` (PL/pgSQL, superadmin-only)
which cascades through all dependent tables in the correct FK order. The
operation is atomic. On success, the world disappears from all listings.

**This cannot be undone.** Verify you have selected the correct world before
confirming.

---

## Data pruning (retention)

### When to use

Turn log entries and settlement/resource snapshots accumulate one record per
turn. For long-running worlds this can become significant. Pruning removes
records older than a configurable retention window.

### Prune procedure

1. Go to `/superadmin/` → **Data Pruning**.
2. Select a world.
3. Set **Retain last N turns** (minimum 1). The latest turn is always retained
   regardless of this value.
4. Click **Preview** to see how many records will be deleted.
5. Review the preview:
   - Eligible settlement snapshots
   - Eligible resource snapshots
   - Eligible turn log entries
   - Turn range that will be retained
6. If the counts look correct, click **Prune** → confirm.

The prune calls `dry_run_prune_world_data` (with `p_dry_run = true`) for the
preview and `prune_world_data` for the real run. Both are superadmin-only
RPCs.

### What is retained

- The current turn and its transition data are always kept.
- Turns `(current - N)` through `current` are retained.
- Turns older than the cutoff are deleted.

**This cannot be undone.** Run the preview first.

---

## User administration

All user administration is available on `/superadmin/`.

### Create a user

Use the **Create User** button (top of the page). This calls the
`admin-create-user` edge function (which uses the Supabase Admin API via the
service-role key) to create a new auth user and the corresponding `app_users`
profile row.

Required fields: email, username, password. The edge function validates
uniqueness and returns the new `userId`.

### Grant / revoke world admin

1. Find the user in the users table.
2. Click **World Admin** (or similar action button) → **World Admin Grant** dialog.
3. Select the world and confirm.

To revoke: use the same dialog to remove the grant. The user's access to the
world is removed immediately.

### Toggle superadmin

1. Find the user in the users table.
2. Click **Toggle Superadmin**.
3. Confirm in the dialog.

Superadmin status grants access to `/superadmin/` and bypasses world-level
access checks. There must always be at least one active superadmin — the toggle
will be rejected if this is the last superadmin account.

### Set active player character

For worlds where users take on a player character, a superadmin can override the
active player character assignment:

1. Find the user → **Active Character** button → **Active Player Character
   Admin** dialog.
2. Select the world and the citizen to assign as the active character.
3. Confirm.

---

## Rate limits

The `end-turn-simulation` and `admin-create-user` edge functions enforce
per-user rate limits to prevent abuse:

| Function              | Limit                           |
| --------------------- | ------------------------------- |
| `end-turn-simulation` | 10 requests per minute per user |
| `admin-create-user`   | (see function source)           |

Rate limit state is stored in the `edge_rate_limit_buckets` table
(token-bucket algorithm). If a user hits the limit, the function returns
HTTP 429 with a `retry-after` header. Rate limit buckets are self-expiring —
no manual reset is needed under normal circumstances.

---

## Audit log

Privileged edge function operations are logged to the Supabase Function logs via
`logEndTurnSuccess` and `logAdminCreateUserSuccess` (see
`supabase/functions/_shared/auditLog.ts`). These log lines are structured JSON
and are visible in the Supabase Dashboard → Edge Functions → Logs.

Fields logged per end-turn success: `userId`, `worldId`, `fromTurnNumber`,
`toTurnNumber`, `transitionId`.
