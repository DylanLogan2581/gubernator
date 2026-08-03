-- Migration: add_settlement_ids_to_settlement_managers_rule
-- #1334: the settlement_managers government-body composition rule gains an
-- optional settlement_ids array. Absent (the pre-existing shape) still means
-- "every settlement manager of the nation"; present means "managers of
-- exactly these settlements" -- membership follows whoever manages them.
-- Only the entry validator changes; is_valid_government_body_composition,
-- the table, and RLS are untouched.
create or replace function public.is_valid_government_body_composition_entry (p_entry jsonb) returns boolean language plpgsql immutable as $$
declare
  v_kind text;
  v_key_count integer;
begin
  if jsonb_typeof(p_entry) <> 'object' then
    return false;
  end if;

  select count(*) into v_key_count from jsonb_object_keys(p_entry);
  v_kind := p_entry->>'kind';

  if v_kind = 'office_type' then
    return v_key_count = 2
      and p_entry ? 'office_type_id'
      and jsonb_typeof(p_entry->'office_type_id') = 'string'
      and (p_entry->>'office_type_id')::uuid is not null;
  elsif v_kind = 'citizens' then
    return v_key_count = 2
      and p_entry ? 'citizen_ids'
      and jsonb_typeof(p_entry->'citizen_ids') = 'array'
      and jsonb_array_length(p_entry->'citizen_ids') > 0
      and not exists (
        select 1
        from jsonb_array_elements_text(p_entry->'citizen_ids') as cid
        where cid::uuid is null
      );
  elsif v_kind = 'ruler' then
    return v_key_count = 1;
  elsif v_kind = 'settlement_managers' then
    return v_key_count = 1
      or (
        v_key_count = 2
        and p_entry ? 'settlement_ids'
        and jsonb_typeof(p_entry->'settlement_ids') = 'array'
        and jsonb_array_length(p_entry->'settlement_ids') > 0
        and not exists (
          select 1
          from jsonb_array_elements_text(p_entry->'settlement_ids') as sid
          where sid::uuid is null
        )
      );
  else
    return false;
  end if;
exception
  when invalid_text_representation then
    return false;
end;
$$;
