-- Migration: add_turn_log_entries
-- Adds append-only, world-scoped storage for turn transition log entries.
-- ---------------------------------------------------------------------------
-- turn_log_entries
-- ---------------------------------------------------------------------------
alter table public.turn_transitions
add constraint turn_transitions_id_world_id_unique unique (id, world_id);

create table public.turn_log_entries (
  id uuid primary key default gen_random_uuid(),
  turn_transition_id uuid not null,
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_id uuid references public.nations (id) on delete set null,
  settlement_id uuid references public.settlements (id) on delete set null,
  citizen_id uuid,
  resource_id uuid,
  log_category text not null,
  payload_jsonb jsonb not null default '{}'::jsonb,
  constraint turn_log_entries_transition_world_fkey foreign key (turn_transition_id, world_id) references public.turn_transitions (id, world_id) on delete cascade,
  constraint turn_log_entries_log_category_check check (char_length(btrim(log_category)) >= 1)
);

comment on column public.turn_log_entries.citizen_id is 'Nullable placeholder for the future citizens table; intentionally not yet constrained by a foreign key.';

comment on column public.turn_log_entries.resource_id is 'Nullable placeholder for the future resources table; intentionally not yet constrained by a foreign key.';

create or replace function public.validate_turn_log_entry_scope () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if
    new.nation_id is not null
    and not exists (
      select
        1
      from
        public.nations
      where
        id = new.nation_id
        and world_id = new.world_id
    )
  then
    raise exception 'turn log nation_id must belong to world_id'
      using errcode = 'check_violation';
  end if;

  if
    new.settlement_id is not null
    and not exists (
      select
        1
      from
        public.settlements s
        inner join public.nations n on n.id = s.nation_id
      where
        s.id = new.settlement_id
        and n.world_id = new.world_id
        and (
          new.nation_id is null
          or s.nation_id = new.nation_id
        )
    )
  then
    raise exception 'turn log settlement_id must belong to world_id and nation_id'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger turn_log_entries_validate_scope before insert
or
update on public.turn_log_entries for each row
execute function public.validate_turn_log_entry_scope ();

create index turn_log_entries_turn_transition_id_idx on public.turn_log_entries (turn_transition_id);

create index turn_log_entries_world_id_idx on public.turn_log_entries (world_id);

alter table public.turn_log_entries enable row level security;

create policy "turn_log_entries_select_world_access" on public.turn_log_entries for
select
  to authenticated using (public.has_world_access (world_id));

create policy "turn_log_entries_insert_world_admin" on public.turn_log_entries for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );
