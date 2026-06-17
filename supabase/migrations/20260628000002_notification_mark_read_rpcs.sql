-- Notification mark-read RPC functions
-- mark_notification_read: mark a single notification as read (recipient-only)
-- mark_all_notifications_read: mark all notifications for current user as read
create or replace function public.mark_notification_read (notification_id uuid) returns table (id uuid, is_read boolean) as $$
begin
  return query
  update public.notifications
  set is_read = true
  where notifications.id = notification_id
    and notifications.recipient_user_id = auth.uid()
  returning notifications.id, notifications.is_read;
end;
$$ language plpgsql security definer
set
  search_path = '';

create or replace function public.mark_all_notifications_read () returns table (updated_count bigint) as $$
declare
  v_count bigint;
begin
  update public.notifications
  set is_read = true
  where recipient_user_id = auth.uid()
    and is_read = false;

  get diagnostics v_count = row_count;
  return query select v_count as updated_count;
end;
$$ language plpgsql security definer
set
  search_path = '';
