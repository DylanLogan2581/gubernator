-- Notification cleanup: per-world mark-all scope, nation/settlement indexes, explicit RPC grants
-- Index to support nation_id filtering in getAllNotifications
create index if not exists notifications_nation_id_idx on public.notifications (nation_id)
where
  nation_id is not null;

-- Index to support settlement_id filtering in getAllNotifications
create index if not exists notifications_settlement_id_idx on public.notifications (settlement_id)
where
  settlement_id is not null;

-- Replace mark_all_notifications_read with an optional world scope.
-- The existing zero-argument function is a different signature; drop it first.
drop function if exists public.mark_all_notifications_read ();

create or replace function public.mark_all_notifications_read (p_world_id uuid default null) returns table (updated_count bigint) as $$
declare
  v_count bigint;
begin
  update public.notifications
  set is_read = true
  where recipient_user_id = auth.uid()
    and is_read = false
    and (p_world_id is null or world_id = p_world_id);

  get diagnostics v_count = row_count;
  return query select v_count as updated_count;
end;
$$ language plpgsql security definer
set
  search_path = '';

-- Explicit grants consistent with other RPCs (revoke from public, grant to authenticated)
revoke all on function public.mark_notification_read (uuid)
from
  public;

grant
execute on function public.mark_notification_read (uuid) to authenticated;

revoke all on function public.mark_all_notifications_read (uuid)
from
  public;

grant
execute on function public.mark_all_notifications_read (uuid) to authenticated;
