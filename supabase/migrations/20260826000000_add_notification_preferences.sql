-- Migration: add_notification_preferences
-- Adds per-user, per-type notification mute preferences (#1028).
--
-- Filtering happens at READ time: notifications are always generated and
-- stored regardless of preference, so re-enabling a muted type immediately
-- restores its history. Only non-default rows are expected to exist — the
-- absence of a row for a (user_id, notification_type) pair means "enabled"
-- (the default), so the app deletes a row when a user re-enables a type
-- instead of leaving an enabled=true row behind.
--
-- notification_type reuses the public.notification_type enum
-- (20260531000002) so the preference row set and the generated TypeScript
-- Constants.public.Enums.notification_type array both stay in lockstep with
-- the DB's source-of-truth type list automatically.
-- ---------------------------------------------------------------------------
-- notification_preferences
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid not null references public.users (id) on delete cascade,
  notification_type public.notification_type not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint notification_preferences_pkey primary key (user_id, notification_type)
);

create trigger notification_preferences_set_updated_at before
update on public.notification_preferences for each row
execute function public.set_updated_at ();

alter table public.notification_preferences enable row level security;

-- ---------------------------------------------------------------------------
-- RLS policies: owner-only for every operation. No super admin or world
-- admin read path — notification preferences are a personal setting, not
-- something that needs support visibility.
-- ---------------------------------------------------------------------------
create policy "notification_preferences_select_own" on public.notification_preferences for
select
  to authenticated using (user_id = public.current_app_user_id ());

create policy "notification_preferences_insert_own" on public.notification_preferences for insert to authenticated
with
  check (user_id = public.current_app_user_id ());

create policy "notification_preferences_update_own" on public.notification_preferences
for update
  to authenticated using (user_id = public.current_app_user_id ())
with
  check (user_id = public.current_app_user_id ());

create policy "notification_preferences_delete_own" on public.notification_preferences for delete to authenticated using (user_id = public.current_app_user_id ());
