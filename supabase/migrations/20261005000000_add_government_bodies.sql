-- Migration: add_government_bodies
-- #1116: reusable voting-body primitive ("The Senate", "Moot of Elders").
-- A body belongs to exactly one nation or one settlement and carries a
-- composition_json rule list; public.resolveBodyMembers (src/shared) is the
-- single source of truth for turning a body + supporting data into a
-- deduplicated, alive voter roster. No RPCs: CRUD authority is enforced
-- entirely by RLS, mirroring office_types (20261003000000) -- the closest
-- existing analog and this feature's own dependency.
-- ---------------------------------------------------------------------------
-- 1. composition_json validation helpers
-- ---------------------------------------------------------------------------
-- Validates a single composition_json array element against the four known
-- rule kinds. Unknown kinds, missing/extra keys, and malformed uuids are all
-- rejected. uuid casts raise invalid_text_representation on bad input, which
-- is caught below and treated as "invalid", not propagated.
create or replace function public.is_valid_government_body_composition_entry (p_entry jsonb) returns boolean language plpgsql immutable as $$
declare
  v_kind text;
  v_key_count integer;
begin
  if jsonb_typeof(p_entry) <> 'object' then
    return false;
  end if;

  select count(*) into v_key_count from jsonb_object_keys(p_entry);
  v_kind := p_entry->>'kind';

  if v_kind = 'office_type' then
    return v_key_count = 2
      and p_entry ? 'office_type_id'
      and jsonb_typeof(p_entry->'office_type_id') = 'string'
      and (p_entry->>'office_type_id')::uuid is not null;
  elsif v_kind = 'citizens' then
    return v_key_count = 2
      and p_entry ? 'citizen_ids'
      and jsonb_typeof(p_entry->'citizen_ids') = 'array'
      and jsonb_array_length(p_entry->'citizen_ids') > 0
      and not exists (
        select 1
        from jsonb_array_elements_text(p_entry->'citizen_ids') as cid
        where cid::uuid is null
      );
  elsif v_kind = 'ruler' then
    return v_key_count = 1;
  elsif v_kind = 'settlement_managers' then
    return v_key_count = 1;
  else
    return false;
  end if;
exception
  when invalid_text_representation then
    return false;
end;
$$;

-- Validates the whole composition_json column: must be a non-empty array
-- where every element passes is_valid_government_body_composition_entry.
create or replace function public.is_valid_government_body_composition (p_composition jsonb) returns boolean language plpgsql immutable as $$
begin
  if jsonb_typeof(p_composition) <> 'array' then
    return false;
  end if;

  if jsonb_array_length(p_composition) = 0 then
    return false;
  end if;

  return not exists (
    select 1
    from jsonb_array_elements(p_composition) as entry
    where not public.is_valid_government_body_composition_entry(entry)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Table
-- ---------------------------------------------------------------------------
create table public.government_bodies (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_id uuid references public.nations (id) on delete cascade,
  settlement_id uuid references public.settlements (id) on delete cascade,
  name text not null,
  description text,
  composition_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint government_bodies_scope_exclusive_check check (
    (
      nation_id is not null
      and settlement_id is null
    )
    or (
      nation_id is null
      and settlement_id is not null
    )
  ),
  constraint government_bodies_name_length_check check (char_length(btrim(name)) >= 1),
  constraint government_bodies_name_max_length_check check (char_length(name) <= 64),
  constraint government_bodies_description_max_length_check check (char_length(description) <= 1000),
  constraint government_bodies_composition_valid_check check (
    public.is_valid_government_body_composition (composition_json)
  )
);

create unique index government_bodies_nation_name_idx on public.government_bodies (nation_id, lower(name))
where
  nation_id is not null;

create unique index government_bodies_settlement_name_idx on public.government_bodies (settlement_id, lower(name))
where
  settlement_id is not null;

create index government_bodies_world_id_idx on public.government_bodies (world_id);

create index government_bodies_nation_id_idx on public.government_bodies (nation_id);

create index government_bodies_settlement_id_idx on public.government_bodies (settlement_id);

create trigger government_bodies_set_updated_at before
update on public.government_bodies for each row
execute function public.set_updated_at ();

comment on table public.government_bodies is 'Named voting bodies ("The Senate", "Moot of Elders") whose membership is a validated composition rule list, resolved at vote time via resolveBodyMembers (src/shared/government). Exactly one of nation_id / settlement_id is set per row (#1116).';

-- ---------------------------------------------------------------------------
-- 3. RLS: world members read; writes require managing the owning nation or
-- settlement (super admin, world admin, nation manager, or -- for
-- settlement-scoped bodies -- settlement manager too), matching
-- current_user_manages_nation / current_user_manages_settlement exactly.
-- world_id, nation_id, and settlement_id are never grant-writable after
-- insert (see column grants below).
-- ---------------------------------------------------------------------------
alter table public.government_bodies enable row level security;

create policy "government_bodies_select_world_access" on public.government_bodies for
select
  to authenticated using (public.current_user_has_world_access (world_id));

create policy "government_bodies_insert_authority" on public.government_bodies for insert to authenticated
with
  check (
    not public.world_is_archived (world_id)
    and (
      case
        when nation_id is not null then public.current_user_manages_nation (nation_id)
        else public.current_user_manages_settlement (settlement_id)
      end
    )
  );

create policy "government_bodies_update_authority" on public.government_bodies
for update
  to authenticated using (
    not public.world_is_archived (world_id)
    and (
      case
        when nation_id is not null then public.current_user_manages_nation (nation_id)
        else public.current_user_manages_settlement (settlement_id)
      end
    )
  )
with
  check (
    case
      when nation_id is not null then public.current_user_manages_nation (nation_id)
      else public.current_user_manages_settlement (settlement_id)
    end
  );

create policy "government_bodies_delete_authority" on public.government_bodies for delete to authenticated using (
  not public.world_is_archived (world_id)
  and (
    case
      when nation_id is not null then public.current_user_manages_nation (nation_id)
      else public.current_user_manages_settlement (settlement_id)
    end
  )
);

grant
select
  on public.government_bodies to authenticated;

grant insert (
  world_id,
  nation_id,
  settlement_id,
  name,
  description,
  composition_json
) on public.government_bodies to authenticated;

grant
update (name, description, composition_json) on public.government_bodies to authenticated;

grant delete on public.government_bodies to authenticated;
