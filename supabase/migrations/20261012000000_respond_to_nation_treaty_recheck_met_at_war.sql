-- ---------------------------------------------------------------------------
-- respond_to_nation_treaty: re-check nations_have_met / at_war at accept time
--
-- Mirrors the propose-time gates in propose_nation_treaty. Without this, a
-- treaty proposed while nations were met and at peace could still be
-- accepted after the nations went to war (or were un-met by an admin),
-- letting the responder activate a treaty against an enemy.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_nation_treaty (
  p_treaty_id uuid,
  p_response text,
  p_responded_by_citizen_id uuid
) returns public.nation_treaties language plpgsql security definer
set
  search_path = '' as $$
declare
  v_treaty  public.nation_treaties;
  v_world_id uuid;
begin
  if p_treaty_id is null or p_response is null or p_responded_by_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_response not in ('accept', 'decline') then
    raise exception 'response must be ''accept'' or ''decline''' using errcode = 'P0001';
  end if;

  select * into v_treaty
    from public.nation_treaties
   where id = p_treaty_id
   for update;

  if v_treaty.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_treaty.status <> 'proposed' then
    raise exception 'treaty cannot be responded to in its current status'
      using errcode = 'P0001';
  end if;

  if not public.current_user_manages_nation (v_treaty.responder_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  v_world_id := v_treaty.world_id;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_response = 'accept' then
    if not public.nations_have_met (v_treaty.proposer_nation_id, v_treaty.responder_nation_id) then
      raise exception 'Nations have not met.' using errcode = 'P0001';
    end if;

    if exists (
      select 1
        from public.nation_relationships nr
       where (
               (nr.from_nation_id = v_treaty.proposer_nation_id and nr.to_nation_id = v_treaty.responder_nation_id)
            or (nr.from_nation_id = v_treaty.responder_nation_id and nr.to_nation_id = v_treaty.proposer_nation_id)
             )
         and nr.current_stance = 'at_war'
    ) then
      raise exception 'nations are at war' using errcode = 'P0001';
    end if;

    update public.nation_treaties
       set status = 'active',
           starts_turn_number = (select w.current_turn_number from public.worlds w where w.id = v_world_id),
           responded_by_citizen_id = p_responded_by_citizen_id
     where id = p_treaty_id
    returning * into v_treaty;
  else
    update public.nation_treaties
       set status = 'declined',
           responded_by_citizen_id = p_responded_by_citizen_id
     where id = p_treaty_id
    returning * into v_treaty;
  end if;

  return v_treaty;
end;
$$;
