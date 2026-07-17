-- Clears Supabase performance-linter findings on RLS policies:
--   • auth_rls_initplan          -> wrap bare auth.uid() in (select auth.uid())
--   • multiple_permissive_policies -> merge per-action permissive policies into one
--
-- No access-semantics change: initplan wraps are evaluation-only, and each merge
-- is the exact logical OR of the dropped policies' predicates (copied verbatim
-- from their defining migrations).
-- ===========================================================================
-- Category B: merge multiple permissive policies (one policy per action)
-- ===========================================================================
-- citizen_memories SELECT: super_admin + world_admin -> one
drop policy "citizen_memories_select_super_admin" on public.citizen_memories;

drop policy "citizen_memories_select_world_admin" on public.citizen_memories;

create policy "citizen_memories_select_admin" on public.citizen_memories for
select
  to authenticated using (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
  );

-- citizens UPDATE: admin + self -> one (using and with check both OR'd)
drop policy "citizens_update_admin" on public.citizens;

drop policy "citizens_update_self" on public.citizens;

create policy "citizens_update_admin_or_self" on public.citizens
for update
  to authenticated using (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
    or (
      citizen_type = 'player_character'
      and user_id = public.current_app_user_id ()
    )
  )
with
  check (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
    or (
      citizen_type = 'player_character'
      and user_id = public.current_app_user_id ()
    )
  );

-- nation_discoveries SELECT: admin + member -> one
drop policy "nation_discoveries_select_admin" on public.nation_discoveries;

drop policy "nation_discoveries_select_member" on public.nation_discoveries;

create policy "nation_discoveries_select_admin_or_member" on public.nation_discoveries for
select
  to authenticated using (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
    or public.current_user_has_player_character_in_nation (nation_a_id)
    or public.current_user_has_player_character_in_nation (nation_b_id)
  );

-- users SELECT: self + super_admin -> one (also clears initplan on the self branch)
drop policy "users_select_self" on public.users;

drop policy "users_select_super_admin" on public.users;

create policy "users_select_self_or_super_admin" on public.users for
select
  to authenticated using (
    id = (
      select
        auth.uid ()
    )
    or public.is_super_admin ()
  );

-- worlds SELECT: admin + player_character + super_admin -> one
drop policy "worlds_select_admin" on public.worlds;

drop policy "worlds_select_player_character" on public.worlds;

drop policy "worlds_select_super_admin" on public.worlds;

create policy "worlds_select_member_or_admin" on public.worlds for
select
  to authenticated using (
    public.is_world_admin (id)
    or public.current_user_has_world_access (id)
    or public.is_super_admin ()
  );

-- worlds UPDATE: super_admin + world_admin -> one (using and with check both OR'd)
drop policy "worlds_update_super_admin" on public.worlds;

drop policy "worlds_update_world_admin" on public.worlds;

create policy "worlds_update_admin" on public.worlds
for update
  to authenticated using (
    public.is_super_admin ()
    or (
      public.is_active_app_user ()
      and public.is_world_admin (id)
      and archived_at is null
    )
  )
with
  check (
    public.is_super_admin ()
    or (
      public.is_active_app_user ()
      and public.is_world_admin (id)
      and archived_at is null
    )
  );

-- ===========================================================================
-- Category A: wrap bare auth.uid() (initplan) — no merge
-- ===========================================================================
-- world_admins_select
drop policy "world_admins_select" on public.world_admins;

create policy "world_admins_select" on public.world_admins for
select
  to authenticated using (
    public.is_active_app_user ()
    and (
      user_id = (
        select
          auth.uid ()
      )
      or public.is_world_admin (world_id)
      or public.is_super_admin ()
    )
  );

-- users_update_own
drop policy "users_update_own" on public.users;

create policy "users_update_own" on public.users
for update
  to authenticated using (
    id = (
      select
        auth.uid ()
    )
    and status = 'active'
  )
with
  check (
    id = (
      select
        auth.uid ()
    )
    and status = 'active'
  );

-- notifications_select_recipient
drop policy "notifications_select_recipient" on public.notifications;

create policy "notifications_select_recipient" on public.notifications for
select
  to authenticated using (
    public.is_active_app_user ()
    and recipient_user_id = (
      select
        auth.uid ()
    )
  );
