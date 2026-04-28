-- Migration: require_active_world_access
-- Ensure suspended/deleted application users do not retain world access through
-- owner, world-admin, public-world, or super-admin paths.
create or replace function public.is_active_app_user () returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and status = 'active'
  )
$$;

create or replace function public.is_super_admin () returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and is_super_admin = true
      and status = 'active'
  )
$$;

create or replace function public.is_world_admin (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_active_app_user()
    and (
      exists (
        select 1
        from public.worlds
        where id = p_world_id
          and owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.world_admins
        where world_id = p_world_id
          and user_id = auth.uid()
      )
    )
$$;

create or replace function public.has_world_access (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    public.is_active_app_user()
    and (
      exists (
        select 1
        from public.worlds
        where id = p_world_id
          and visibility = 'public'
      )
      or public.is_world_admin(p_world_id)
      or public.is_super_admin()
    )
$$;

drop policy "worlds_select_owner" on public.worlds;

create policy "worlds_select_owner" on public.worlds for
select
  to authenticated using (
    public.is_active_app_user ()
    and owner_id = auth.uid ()
  );

drop policy "worlds_select_public" on public.worlds;

create policy "worlds_select_public" on public.worlds for
select
  to authenticated using (
    public.is_active_app_user ()
    and visibility = 'public'
  );

drop policy "worlds_insert_authenticated" on public.worlds;

create policy "worlds_insert_authenticated" on public.worlds for insert to authenticated
with
  check (
    public.is_active_app_user ()
    and owner_id = auth.uid ()
  );

drop policy "worlds_update_owner" on public.worlds;

create policy "worlds_update_owner" on public.worlds
for update
  to authenticated using (
    public.is_active_app_user ()
    and owner_id = auth.uid ()
  )
with
  check (
    public.is_active_app_user ()
    and owner_id = auth.uid ()
  );

drop policy "worlds_delete_owner" on public.worlds;

create policy "worlds_delete_owner" on public.worlds for delete to authenticated using (
  public.is_active_app_user ()
  and owner_id = auth.uid ()
);

drop policy "world_admins_select" on public.world_admins;

create policy "world_admins_select" on public.world_admins for
select
  to authenticated using (
    public.is_active_app_user ()
    and (
      user_id = auth.uid ()
      or public.is_world_admin (world_id)
      or public.is_super_admin ()
    )
  );

drop policy "world_admins_insert" on public.world_admins;

create policy "world_admins_insert" on public.world_admins for insert to authenticated
with
  check (
    public.is_active_app_user ()
    and (
      public.is_world_admin (world_id)
      or public.is_super_admin ()
    )
  );

drop policy "world_admins_delete" on public.world_admins;

create policy "world_admins_delete" on public.world_admins for delete to authenticated using (
  public.is_active_app_user ()
  and (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  )
);
