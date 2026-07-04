-- Migration: revoke_citizen_memories_direct_writes
-- Routes all citizen_memories writes through the guarded SECURITY DEFINER RPCs
-- by revoking INSERT, UPDATE, and DELETE on public.citizen_memories from the
-- authenticated role. Direct table-API mutations bypassed the archived-world
-- rejection, turn-number upper bound, empty-text guard, and
-- created_by_user_id = auth.uid() checks that only exist inside
-- add_citizen_memory / update_citizen_memory
-- (20260630000001_add_citizen_memories.sql). delete_citizen_memory already
-- enforces the same admin + archived-world checks, so DELETE is revoked too.
--
-- The write policies introduced in 20260630000001_add_citizen_memories.sql are
-- dropped: with no table-level grant the policies are unreachable and their
-- presence is misleading. The three SECURITY DEFINER RPCs (add_citizen_memory,
-- update_citizen_memory, delete_citizen_memory) run under the function-owner
-- privileges and are unaffected by the revoke, as is the event-patch inserter
-- in 20260701000000_event_patches_and_citizen_memories.sql.
--
-- Precedent: 20260525000006_revoke_partnership_direct_writes.sql
revoke insert,
update,
delete on public.citizen_memories
from
  authenticated;

drop policy if exists "citizen_memories_insert_super_admin" on public.citizen_memories;

drop policy if exists "citizen_memories_insert_world_admin" on public.citizen_memories;

drop policy if exists "citizen_memories_update_super_admin" on public.citizen_memories;

drop policy if exists "citizen_memories_update_world_admin" on public.citizen_memories;

drop policy if exists "citizen_memories_delete_super_admin" on public.citizen_memories;

drop policy if exists "citizen_memories_delete_world_admin" on public.citizen_memories;
