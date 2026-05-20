-- Migration: restrict_notification_writes
-- Removes direct browser-authenticated write access to public.notifications and
-- constrains the notification_type column to the known system allowlist.
-- Notification rows are generated exclusively by privileged paths such as
-- advance_world_turn_if_current (SECURITY DEFINER, restricted to the service
-- role), so UI and future workflows can trust notification provenance. Column
-- privileges are checked before RLS, so the surviving insert policy becomes
-- unreachable and is dropped to keep the policy surface honest.
-- ---------------------------------------------------------------------------
revoke insert,
update,
delete on public.notifications
from
  authenticated;

drop policy if exists "notifications_insert_own_world_access" on public.notifications;

-- ---------------------------------------------------------------------------
-- Allowlist notification_type to the values the system currently emits. New
-- generated types must extend this constraint as part of their migration,
-- preventing forged or stale types from slipping through privileged paths.
-- ---------------------------------------------------------------------------
alter table public.notifications
drop constraint if exists notifications_notification_type_check;

alter table public.notifications
add constraint notifications_notification_type_check check (notification_type in ('turn.completed'));
