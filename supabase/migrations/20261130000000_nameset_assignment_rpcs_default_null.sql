-- Add a `default null` to p_nameset_id on the nation/settlement nameset
-- assignment RPCs so the generated TypeScript types mark the argument
-- optional, letting callers omit it to clear the override instead of
-- forcing a `string | null -> string` cast at the call site.
create or replace function public.set_nation_nameset (
  p_nation_id uuid,
  p_world_id uuid,
  p_nameset_id uuid default null -- null to clear the override
) returns table (id uuid, world_id uuid, nameset_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_nation_world_id uuid;
begin
  if p_nation_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select n.world_id into v_nation_world_id
  from public.nations n
  where n.id = p_nation_id;

  if v_nation_world_id is null or v_nation_world_id <> p_world_id then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status into v_world_status from public.worlds w where w.id = p_world_id;
  if v_world_status = 'archived' then
    raise exception 'World is archived.' using errcode = 'P0001';
  end if;

  -- Validate nameset belongs to the same world (if not null).
  if p_nameset_id is not null then
    if not exists (
      select 1 from public.namesets ns
      where ns.id = p_nameset_id and ns.world_id = p_world_id and not ns.is_trashed
    ) then
      raise exception 'not found' using errcode = 'P0002';
    end if;
  end if;

  update public.nations
  set nameset_id = p_nameset_id, updated_at = now()
  where nations.id = p_nation_id;

  return query select p_nation_id, p_world_id, p_nameset_id;
end;
$$;

create or replace function public.set_settlement_nameset (
  p_settlement_id uuid,
  p_world_id uuid,
  p_nameset_id uuid default null -- null to clear the override
) returns table (id uuid, world_id uuid, nameset_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_settlement_world_id uuid;
begin
  if p_settlement_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select n.world_id into v_settlement_world_id
  from public.settlements s
  inner join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_settlement_world_id is null or v_settlement_world_id <> p_world_id then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status into v_world_status from public.worlds w where w.id = p_world_id;
  if v_world_status = 'archived' then
    raise exception 'World is archived.' using errcode = 'P0001';
  end if;

  -- Validate nameset belongs to the same world (if not null).
  if p_nameset_id is not null then
    if not exists (
      select 1 from public.namesets ns
      where ns.id = p_nameset_id and ns.world_id = p_world_id and not ns.is_trashed
    ) then
      raise exception 'not found' using errcode = 'P0002';
    end if;
  end if;

  update public.settlements
  set nameset_id = p_nameset_id, updated_at = now()
  where settlements.id = p_settlement_id;

  return query select p_settlement_id, p_world_id, p_nameset_id;
end;
$$;
