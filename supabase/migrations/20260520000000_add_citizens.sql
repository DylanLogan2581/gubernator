-- Migration: add_citizens
-- Adds the merged citizens table covering both NPCs and player characters per
-- the simplified Epic 3 schema plan. Establishes broad read access at the
-- database boundary (super admins, world admins of the citizen's world, the
-- Nation/Settlement Manager whose active player character governs the
-- citizen's nation or settlement, and any user controlling at least one
-- player character in the citizen's world) and narrow write access (super
-- admin and world admin via the table API, plus self-edits for player
-- characters on non-sensitive columns). The user_id and role_* columns are
-- locked from direct table writes; they are mutated only via the dedicated
-- character-link and role-assignment mutation introduced in a later issue.
-- ---------------------------------------------------------------------------
-- citizens
-- ---------------------------------------------------------------------------
create table public.citizens (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  settlement_id uuid references public.settlements (id) on delete set null,
  citizen_type text not null,
  name text not null,
  sex text,
  status text not null default 'alive',
  born_on_turn_number integer,
  parent_a_citizen_id uuid references public.citizens (id) on delete set null,
  parent_b_citizen_id uuid references public.citizens (id) on delete set null,
  user_id uuid references public.users (id) on delete restrict,
  profile_photo_url text,
  role_type text not null default 'none',
  role_nation_id uuid references public.nations (id) on delete restrict,
  role_settlement_id uuid references public.settlements (id) on delete restrict,
  personality_text text,
  skills_text text,
  npc_trait_1 text,
  npc_trait_2 text,
  npc_secret_contradiction text,
  npc_goal text,
  npc_flaw text,
  death_cause text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint citizens_citizen_type_check check (citizen_type in ('npc', 'player_character')),
  constraint citizens_role_type_check check (
    role_type in ('none', 'nation_manager', 'settlement_manager')
  ),
  constraint citizens_status_check check (status in ('alive', 'dead')),
  constraint citizens_name_length_check check (char_length(btrim(name)) >= 1),
  constraint citizens_name_max_length_check check (char_length(name) <= 64),
  constraint citizens_player_character_user_id_check check (
    (
      citizen_type = 'player_character'
      and user_id is not null
    )
    or (
      citizen_type = 'npc'
      and user_id is null
    )
  ),
  constraint citizens_role_scope_check check (
    (
      role_type = 'none'
      and role_nation_id is null
      and role_settlement_id is null
    )
    or (
      role_type = 'nation_manager'
      and role_nation_id is not null
      and role_settlement_id is null
    )
    or (
      role_type = 'settlement_manager'
      and role_settlement_id is not null
      and role_nation_id is null
    )
  ),
  constraint citizens_no_self_parent_check check (
    (
      parent_a_citizen_id is null
      or parent_a_citizen_id <> id
    )
    and (
      parent_b_citizen_id is null
      or parent_b_citizen_id <> id
    )
  )
);

create index citizens_world_settlement_idx on public.citizens (world_id, settlement_id);

create index citizens_world_user_idx on public.citizens (world_id, user_id);

create index citizens_role_nation_idx on public.citizens (role_type, role_nation_id);

create index citizens_role_settlement_idx on public.citizens (role_type, role_settlement_id);

create trigger citizens_set_updated_at before
update on public.citizens for each row
execute function public.set_updated_at ();

alter table public.citizens enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they bypass citizens RLS and do not
-- self-recursively trigger the same policy from inside a policy expression).
-- ---------------------------------------------------------------------------
create or replace function public.is_nation_manager_of (p_nation_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.citizens c
    where c.user_id = auth.uid()
      and c.citizen_type = 'player_character'
      and c.role_type = 'nation_manager'
      and c.role_nation_id = p_nation_id
      and c.status = 'alive'
  )
$$;

create or replace function public.is_settlement_manager_of (p_settlement_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.citizens c
    where c.user_id = auth.uid()
      and c.citizen_type = 'player_character'
      and c.role_type = 'settlement_manager'
      and c.role_settlement_id = p_settlement_id
      and c.status = 'alive'
  )
$$;

create or replace function public.user_has_player_character_in_world (p_world_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.citizens c
    where c.user_id = auth.uid()
      and c.citizen_type = 'player_character'
      and c.world_id = p_world_id
  )
$$;

revoke all on function public.is_nation_manager_of (uuid)
from
  public;

revoke all on function public.is_settlement_manager_of (uuid)
from
  public;

revoke all on function public.user_has_player_character_in_world (uuid)
from
  public;

grant
execute on function public.is_nation_manager_of (uuid) to authenticated;

grant
execute on function public.is_settlement_manager_of (uuid) to authenticated;

grant
execute on function public.user_has_player_character_in_world (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- Read: intentionally broad so Nation/Settlement Managers and player
-- characters can compute aggregate counts and statistics across their scope.
-- Aggregate-only restrictions are enforced in the UI layer, not in RLS.
create policy "citizens_select_visible" on public.citizens for
select
  to authenticated using (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
    or (
      settlement_id is not null
      and exists (
        select
          1
        from
          public.settlements s
        where
          s.id = citizens.settlement_id
          and public.is_nation_manager_of (s.nation_id)
      )
    )
    or (
      settlement_id is not null
      and public.is_settlement_manager_of (settlement_id)
    )
    or public.user_has_player_character_in_world (world_id)
  );

create policy "citizens_insert_world_admin" on public.citizens for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

-- Update: admins on the full row; player characters only on their own row.
-- Column-level grants below further restrict which columns either path can
-- touch through the table API (role_type, role_nation_id, role_settlement_id,
-- user_id, world_id, and system timestamps are all unreachable directly).
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

create policy "citizens_delete_world_admin" on public.citizens for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- ---------------------------------------------------------------------------
-- Column-level privileges: narrow direct INSERT/UPDATE to non-sensitive
-- columns. Scope columns (world_id) become INSERT-only so admins cannot
-- relocate citizens across worlds through the table API. Role columns and
-- user_id are entirely unreachable through direct REST calls and are mutated
-- only by the dedicated character-link and role-assignment SECURITY DEFINER
-- mutation introduced in a later migration. Column-level privileges are
-- checked before RLS, so the restriction applies independently of policy
-- logic and any future columns added to this table stay locked down by
-- default.
-- ---------------------------------------------------------------------------
revoke insert,
update on public.citizens
from
  authenticated;

grant insert (
  id,
  world_id,
  settlement_id,
  citizen_type,
  name,
  sex,
  status,
  born_on_turn_number,
  parent_a_citizen_id,
  parent_b_citizen_id,
  profile_photo_url,
  personality_text,
  skills_text,
  npc_trait_1,
  npc_trait_2,
  npc_secret_contradiction,
  npc_goal,
  npc_flaw,
  death_cause
) on public.citizens to authenticated;

grant
update (
  settlement_id,
  name,
  sex,
  status,
  born_on_turn_number,
  parent_a_citizen_id,
  parent_b_citizen_id,
  profile_photo_url,
  personality_text,
  skills_text,
  npc_trait_1,
  npc_trait_2,
  npc_secret_contradiction,
  npc_goal,
  npc_flaw,
  death_cause
) on public.citizens to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill the settlements.ready_set_by_citizen_id placeholder with a real
-- foreign key now that citizens exists. ON DELETE SET NULL so a citizen's
-- removal does not erase the settlement's readiness audit row.
-- ---------------------------------------------------------------------------
alter table public.settlements
add constraint settlements_ready_set_by_citizen_id_fkey foreign key (ready_set_by_citizen_id) references public.citizens (id) on delete set null;

comment on column public.settlements.ready_set_by_citizen_id is 'Citizen who toggled readiness for the current turn. Set to null when readiness is cleared or when the citizen row is deleted.';
