# Partition Migration Runbook

Operational guide for applying the two Phase 1 partitioning migrations to a
database that already holds real turn history:

- `supabase/migrations/20261125000000_partition_settlement_turn_resource_snapshots.sql`
- `supabase/migrations/20261126000000_partition_turn_log_entries.sql`

Both migrations recreate a live table as a partitioned table, copy every row
with a single un-batched `INSERT … SELECT`, verify an integrity self-check, then
`DROP` the old table and `RENAME` the new one into place — all inside one
migration transaction. On an empty or small database they are a no-op-fast
schema change and need no ceremony. On a database with real history they are a
long, lock-heavy transaction and need the maintenance-window procedure below.

Batching the copy would not help: the whole migration is one transaction, so the
`ACCESS EXCLUSIVE` lock is held from the first statement to `COMMIT` either way.
The mitigation is operational, not code.

---

## Lock and duration characteristics

| Property              | Behaviour                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Lock                  | `ACCESS EXCLUSIVE` on the target table for the whole transaction (the `DROP`/`RENAME` steps take it; the copy already holds a weaker lock).  |
| Blocked while running | All reads and writes of `settlement_turn_resource_snapshots` / `turn_log_entries` — including the end-turn simulation and turn-log UI reads. |
| Dominant cost         | The `INSERT … SELECT` copy, plus index/constraint builds on the new partitions.                                                              |
| Rough throughput      | Order of 1–3 minutes per million rows on modest hosted hardware; assume the slow end and add headroom for the digest self-check pass.        |
| Also copied           | The snapshots migration drops and recreates `nation_turn_resource_aggregates` and `world_turn_resource_aggregates` (views, cheap).           |

**Threshold:** if either table holds **more than ~250k rows** (roughly a
one-month-old busy world, or any world past its first simulated year), schedule a
maintenance window. Below that, applying during normal operation is acceptable,
but still confirm no turn is in flight.

For scale reference, a large hosted world writes on the order of 2.2M
`settlement_turn_resource_snapshots` rows per simulated year.

---

## 1. Pre-flight

Run against the target database **before** the window, to size it:

```sql
-- Total rows per table.
select
  'settlement_turn_resource_snapshots' as table_name,
  count(*)
from
  public.settlement_turn_resource_snapshots
union all
select
  'turn_log_entries',
  count(*)
from
  public.turn_log_entries;

-- Rows and turn range per world (drives how many partitions get created).
select
  world_id,
  count(*) as rows,
  min(turn_number) as min_turn,
  max(turn_number) as max_turn
from
  public.settlement_turn_resource_snapshots
group by
  world_id
order by
  rows desc;

select
  world_id,
  count(*) as rows
from
  public.turn_log_entries
group by
  world_id
order by
  rows desc;

-- On-disk size (indexes included).
select
  pg_size_pretty (
    pg_total_relation_size ('public.settlement_turn_resource_snapshots')
  ),
  pg_size_pretty (
    pg_total_relation_size ('public.turn_log_entries')
  );
```

Checklist:

- [ ] Row counts recorded per table (you will compare them after the migration).
- [ ] A fresh backup exists (`docker compose exec db pg_dumpall -U postgres > backup.sql`).
- [ ] Free disk ≥ 2× the combined size of both tables — the copy coexists with the
      original until `COMMIT`.
- [ ] Estimated duration fits the window, using the throughput figure above.

---

## 2. Maintenance window

1. **Pause the turn engine.** End turn runs as an Edge Function, so stopping the
   functions service is the pause switch:

   ```bash
   cd docker && docker compose stop functions
   ```

   Confirm no turn is mid-flight first (no `turn_transitions` row in progress).
   Optionally stop the `app` service too, so players see a hard outage rather
   than hanging requests.

2. **Raise the statement timeout for the migration session.** The default hosted
   timeout will abort a multi-million-row copy. Apply the migrations from a psql
   session that sets:

   ```sql
   set
     statement_timeout = 0;
   
   set
     lock_timeout = '10s';
   
   set
     idle_in_transaction_session_timeout = 0;
   ```

   `lock_timeout` makes the migration fail fast if something still holds a
   conflicting lock, instead of queueing behind it.

3. **Apply the migrations** (the `migrate` service, or `supabase db push` /
   `psql -f` for a manual run). Apply them in filename order — the snapshots
   migration first.

4. **Restart the services** once verification (step 3) passes:

   ```bash
   docker compose start functions app
   ```

---

## 3. Verify

The migrations verify themselves: before dropping anything, each compares the
old and new tables on row count, numeric column sums (snapshots only), and an
order-independent `hashtextextended` digest over the key columns. A mismatch
raises and aborts the transaction. So a **successful apply is itself the
integrity proof** — there is no partial-copy outcome to inspect.

Post-apply spot checks:

```sql
-- Both tables are now partitioned parents, and the old tables are gone.
select relname, relkind from pg_class
where relname in ('settlement_turn_resource_snapshots', 'turn_log_entries');
-- expect relkind = 'p' for both

select count(*) from pg_inherits
where inhparent = 'public.settlement_turn_resource_snapshots'::regclass;
-- expect one child per world (each further partitioned by turn range)

-- Row counts match the pre-flight numbers.
select count(*) from public.settlement_turn_resource_snapshots;
select count(*) from public.turn_log_entries;

-- No leftover scratch names.
select relname from pg_class
where relname in ('settlement_turn_resource_snapshots_p', 'turn_log_entries_p');
-- expect zero rows

-- RLS is enabled on every parent AND every partition. The migrations secure
-- each partition explicitly (own policies + revoked direct writes), because a
-- partition is directly addressable via PostgREST; this must return zero rows.
with recursive tree (oid) as (
  select unnest(array[
    'public.settlement_turn_resource_snapshots'::regclass,
    'public.turn_log_entries'::regclass
  ])
  union all
  select i.inhrelid from pg_inherits i join tree t on i.inhparent = t.oid
)
select c.relname
from tree join pg_class c on c.oid = tree.oid
where not c.relrowsecurity;
```

Then, with the turn engine back up:

- [ ] End turn completes on one world and writes new snapshot / turn-log rows.
- [ ] The turn log UI and the resource aggregate views return data.

---

## 4. Rollback

Each migration is a single atomic transaction, so rollback is automatic and
there is no manual undo procedure:

- **Integrity check fails** → the transaction aborts before `DROP`. The original
  table is untouched and still canonical; the partitioned scratch table
  (`…_p`) never existed outside the aborted transaction. Investigate the raised
  message (it prints the old/new counts, sums, and digests), then retry.
- **Statement/lock timeout, or the connection drops mid-copy** → same outcome:
  the transaction rolls back, no data is lost. Raise the timeout (step 2.2) and
  retry.
- **Failure after a successful commit** (e.g. an application-level problem found
  later) → the old table no longer exists. Recovery is restore-from-backup, which
  is why the pre-flight backup is mandatory.

Re-running a rolled-back migration is safe: it starts again from the original
table.
