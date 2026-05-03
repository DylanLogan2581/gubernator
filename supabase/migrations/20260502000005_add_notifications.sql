-- Migration: add_notifications
-- Adds recipient-owned notification rows for turn transition outcomes.
-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users (id) on delete cascade,
  world_id uuid not null references public.worlds (id) on delete cascade,
  citizen_id uuid,
  nation_id uuid references public.nations (id) on delete set null,
  settlement_id uuid references public.settlements (id) on delete set null,
  event_id uuid,
  trade_route_id uuid,
  notification_type text not null,
  message_text text not null,
  is_read boolean not null default false,
  generated_in_transition_id uuid,
  generated_at timestamptz not null default now(),
  constraint notifications_transition_world_fkey foreign key (generated_in_transition_id, world_id) references public.turn_transitions (id, world_id) on delete cascade,
  constraint notifications_notification_type_check check (char_length(btrim(notification_type)) >= 1),
  constraint notifications_message_text_check check (char_length(btrim(message_text)) >= 1)
);

comment on column public.notifications.citizen_id is 'Nullable placeholder for the future citizens table; intentionally not yet constrained by a foreign key.';

comment on column public.notifications.event_id is 'Nullable placeholder for the future events table; intentionally not yet constrained by a foreign key.';

comment on column public.notifications.trade_route_id is 'Nullable placeholder for the future trade_routes table; intentionally not yet constrained by a foreign key.';

create or replace function public.validate_notification_scope () returns trigger language plpgsql security definer
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
    raise exception 'notification nation_id must belong to world_id'
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
    raise exception 'notification settlement_id must belong to world_id and nation_id'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger notifications_validate_scope before insert
or
update on public.notifications for each row
execute function public.validate_notification_scope ();

create index notifications_recipient_unread_generated_at_idx on public.notifications (recipient_user_id, is_read, generated_at desc);

create index notifications_world_id_idx on public.notifications (world_id);

create index notifications_generated_in_transition_id_idx on public.notifications (generated_in_transition_id);

alter table public.notifications enable row level security;

create policy "notifications_select_recipient" on public.notifications for
select
  to authenticated using (
    public.is_active_app_user ()
    and recipient_user_id = auth.uid ()
  );

create policy "notifications_insert_own_world_access" on public.notifications for insert to authenticated
with
  check (
    public.is_active_app_user ()
    and recipient_user_id = auth.uid ()
    and public.has_world_access (world_id)
  );
