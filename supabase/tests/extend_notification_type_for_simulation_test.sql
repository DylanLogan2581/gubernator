-- pgTAP tests for the Epic 6 simulation outcome notification_type values.
-- Inserts one notifications row per new enum value and asserts each row exists.
-- Run with: npx supabase test db
begin;

select
  plan (16);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    'b1000000-0000-0000-0000-000000000001',
    'sim-enum-test@example.com',
    'x',
    now(),
    '{"username":"sim_enum_test"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'Sim Enum Test World',
    1,
    'private',
    'active'
  );

-- Insert one row per new Epic 6 enum value (runs as postgres / table owner,
-- bypassing RLS so the system-only insert path is exercised cleanly).
insert into
  public.notifications (
    recipient_user_id,
    world_id,
    notification_type,
    message_text
  )
values
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'building.auto_deconstructed',
    'Building was auto-deconstructed.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'building.recovered',
    'Building recovered.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'building.suspended',
    'Building was suspended.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'citizen.born',
    'Citizen was born.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'citizen.died',
    'Citizen died.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'construction.completed',
    'Construction completed.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'construction.paused',
    'Construction paused.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'deposit.depleted',
    'Deposit depleted.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'managed_population.declining',
    'Managed population declining.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'managed_population.extinct',
    'Managed population extinct.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'partnership.formed',
    'Partnership formed.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'partnership.widowed',
    'Partnership widowed.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'settlement.homelessness_occurred',
    'Settlement homelessness occurred.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'settlement.starvation_occurred',
    'Settlement starvation occurred.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'trade_route.paused',
    'Trade route paused.'
  ),
  (
    'b1000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'trade_route.resumed',
    'Trade route resumed.'
  );

-- ---------------------------------------------------------------------------
-- Assertions: one per new enum value
-- ---------------------------------------------------------------------------
select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'building.auto_deconstructed'
    ),
    'building.auto_deconstructed is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'building.recovered'
    ),
    'building.recovered is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'building.suspended'
    ),
    'building.suspended is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.born'
    ),
    'citizen.born is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'citizen.died'
    ),
    'citizen.died is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'construction.completed'
    ),
    'construction.completed is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'construction.paused'
    ),
    'construction.paused is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'deposit.depleted'
    ),
    'deposit.depleted is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'managed_population.declining'
    ),
    'managed_population.declining is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'managed_population.extinct'
    ),
    'managed_population.extinct is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'partnership.formed'
    ),
    'partnership.formed is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'partnership.widowed'
    ),
    'partnership.widowed is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'settlement.homelessness_occurred'
    ),
    'settlement.homelessness_occurred is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'settlement.starvation_occurred'
    ),
    'settlement.starvation_occurred is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'trade_route.paused'
    ),
    'trade_route.paused is a valid notification_type'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
        and notification_type = 'trade_route.resumed'
    ),
    'trade_route.resumed is a valid notification_type'
  );

rollback;
