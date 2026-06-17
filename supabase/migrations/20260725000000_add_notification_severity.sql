-- Migration: add_notification_severity
-- Issue #884: Add severity (info/warning/critical) to notifications for UI prioritisation.
--
-- Changes:
--   1. Create notification_severity enum: info < warning < critical.
--   2. Add severity column (not null, default 'info') to notifications.
--   3. Backfill existing rows: map each notification_type to a severity level.
--      · critical — starvation, extinction, player death
--      · warning  — population decline, homelessness, building suspension/destruction,
--                   construction pauses, deposit depletion, cancelled/rejected trade,
--                   paused trade routes, death events, widowing
--      · info     — routine events (turn completed, proposals received, buildings
--                   recovered, births, construction completed, etc.)
--   4. RLS: unchanged (severity is a data-model concern, not an access-control one).
-- ---------------------------------------------------------------------------
-- 1. Create the enum.
create type public.notification_severity as enum('info', 'warning', 'critical');

-- 2. Add the column with a safe default; every existing row becomes 'info'.
alter table public.notifications
add column severity public.notification_severity not null default 'info';

-- 3. Backfill critical notifications.
update public.notifications
set
  severity = 'critical'
where
  notification_type in (
    'managed_population.extinct',
    'settlement.starvation_occurred',
    'player.died'
  );

-- 4. Backfill warning notifications.
update public.notifications
set
  severity = 'warning'
where
  notification_type in (
    'managed_population.declining',
    'settlement.homelessness_occurred',
    'building.auto_deconstructed',
    'building.suspended',
    'construction.paused',
    'deposit.depleted',
    'trade_route_cancelled',
    'trade_proposal_rejected',
    'trade_route.paused',
    'player.widowed',
    'partnership.widowed',
    'citizen.died'
  );

-- Remaining rows retain the default 'info' severity.
