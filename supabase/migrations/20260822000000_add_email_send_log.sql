-- Migration: add_email_send_log
-- Audit log for app-originated emails sent via the send-email Edge Function
-- (manual notification sender + "send test email to me" on /superadmin/email).
--
-- All writes go through the send-email Edge Function using the service_role
-- key, which bypasses RLS. Client writes are blocked; super admins retain
-- SELECT for operational visibility (issue #1016).
create table public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid references public.users (id) on delete set null,
  recipient_spec jsonb not null,
  subject text not null check (char_length(subject) between 1 and 200),
  recipient_count integer not null check (recipient_count >= 0),
  created_at timestamptz not null default now()
);

comment on column public.email_send_log.sender_user_id is 'Superadmin who triggered the send. Set to null when the referenced user is deleted so account deletion is never blocked by this audit column.';

comment on column public.email_send_log.recipient_spec is 'Recipient selection as resolved by the Edge Function, e.g. {"kind":"all"} | {"kind":"specific","user_ids":[...]} | {"kind":"world","world_id":"..."} | {"kind":"nation","nation_id":"..."}.';

create index email_send_log_sender_user_id_idx on public.email_send_log (sender_user_id);

create index email_send_log_created_at_idx on public.email_send_log (created_at);

alter table public.email_send_log enable row level security;

-- Super admins may read the send log for operational visibility.
-- No INSERT/UPDATE/DELETE policies: all writes go through service_role.
create policy email_send_log_select_super_admin on public.email_send_log for
select
  to authenticated using (public.is_super_admin ());
