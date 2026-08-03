-- Migration: persist_currency_default_state
-- #1135: fix three currency-default defects from #1094:
--   1. nation_currencies had no is_in_default column, so
--      internal_apply_turn_transition_nation_currency silently dropped the
--      engine's nationCurrencyUpdates[].isInDefault flag — the docstring
--      claimed it was persisted but only confidence was written.
--   2. Without a persisted prior default state, the engine
--      (phaseNationalEconomy.ts) could not detect the false->true
--      *transition*, so currency.default notifications / currency_default
--      logs re-fired every turn a currency sat in default.
--   3. confidence was written unclamped — an out-of-range engine value would
--      violate nation_currencies_confidence_check and fail the whole turn
--      transition.
-- ---------------------------------------------------------------------------
-- 1. nation_currencies.is_in_default
-- ---------------------------------------------------------------------------
alter table public.nation_currencies
add column is_in_default boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Redefine internal_apply_turn_transition_nation_currency (§C38, body
-- copied from 20260918000001, the latest definition) to also persist
-- is_in_default and clamp confidence to [0, 1] before writing it.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_nation_currency (
  p_transition_id uuid,
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb,
  out nation_currency_snapshot_count integer,
  out nation_currency_update_count integer,
  out nation_currency_notification_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_snapshot jsonb;
  v_update jsonb;
  v_notification jsonb;
  v_notif_type public.notification_type;
  v_notif_severity public.notification_severity;
  v_rows integer;
begin
  nation_currency_snapshot_count      := 0;
  nation_currency_update_count        := 0;
  nation_currency_notification_count  := 0;

  for v_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencySnapshots', '[]'::jsonb))
  loop
    insert into
      public.nation_currency_snapshots (
        turn_transition_id,
        world_id,
        nation_id,
        currency_id,
        turn_number,
        money_supply,
        reserve_quantity,
        confidence,
        minted,
        burned
      )
    values
      (
        p_transition_id,
        p_world_id,
        (v_snapshot ->> 'nationId')::uuid,
        (v_snapshot ->> 'currencyId')::uuid,
        p_expected_turn_number,
        coalesce((v_snapshot ->> 'moneySupply')::numeric, 0),
        coalesce((v_snapshot ->> 'reserveQuantity')::numeric, 0),
        least(greatest(coalesce((v_snapshot ->> 'confidence')::numeric, 1), 0), 1),
        coalesce((v_snapshot ->> 'minted')::numeric, 0),
        coalesce((v_snapshot ->> 'burned')::numeric, 0)
      ) on conflict on constraint nation_currency_snapshots_unique do nothing;

    nation_currency_snapshot_count := nation_currency_snapshot_count + 1;
  end loop;

  for v_update in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationCurrencyUpdates', '[]'::jsonb))
  loop
    update public.nation_currencies
    set
      confidence    = least(greatest(coalesce((v_update ->> 'confidence')::numeric, confidence), 0), 1),
      is_in_default = coalesce((v_update ->> 'isInDefault')::boolean, is_in_default)
    where
      id = (v_update ->> 'currencyId')::uuid;

    nation_currency_update_count := nation_currency_update_count + 1;
  end loop;

  -- currency.default / currency.confidence_collapsing: read straight from the
  -- generic notifications array (scope 'nation'), filtered to just these two
  -- types. Recipients: nation manager of the affected nation + world admins
  -- + super admins — same pattern as the nation-scope blocks in 20260915000001.
  for v_notification in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'notifications', '[]'::jsonb))
    where value ->> 'notificationType' in ('currency.default', 'currency.confidence_collapsing')
  loop
    v_notif_type := (v_notification ->> 'notificationType')::public.notification_type;
    v_notif_severity := case v_notif_type
      when 'currency.default' then 'critical'::public.notification_severity
      else 'warning'::public.notification_severity
    end;

    insert into public.notifications (
      recipient_user_id,
      world_id,
      nation_id,
      notification_type,
      message_text,
      severity,
      generated_in_transition_id
    )
    select
      recipients.user_id,
      p_world_id,
      (v_notification ->> 'nationId')::uuid,
      v_notif_type,
      v_notification ->> 'messageText',
      v_notif_severity,
      p_transition_id
    from (
      select c.user_id
      from public.citizens c
      inner join public.users u on u.id = c.user_id
      where c.role_type = 'nation_manager'
        and c.role_nation_id = (v_notification ->> 'nationId')::uuid
        and c.status = 'alive'
        and c.citizen_type = 'player_character'
        and c.user_id is not null
        and u.status = 'active'
      union
      select wa.user_id
      from public.world_admins wa
      inner join public.users u on u.id = wa.user_id
      where wa.world_id = p_world_id
        and u.status = 'active'
      union
      select u.id
      from public.users u
      where u.is_super_admin = true
        and u.status = 'active'
    ) as recipients (user_id)
    on conflict (
      generated_in_transition_id,
      recipient_user_id,
      notification_type,
      coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(citizen_id, '00000000-0000-0000-0000-000000000000'::uuid),
      coalesce(settlement_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) where generated_in_transition_id is not null
    do nothing;

    get diagnostics v_rows = row_count;
    nation_currency_notification_count := nation_currency_notification_count + v_rows;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_nation_currency (uuid, uuid, integer, jsonb)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_nation_currency (uuid, uuid, integer, jsonb)
from
  anon,
  authenticated;
