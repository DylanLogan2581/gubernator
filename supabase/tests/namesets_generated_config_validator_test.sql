-- pgTAP tests for the "generated" nameset config shape (#1252).
-- Covers: is_valid_naming_config() accepting a well-formed generated config,
-- rejecting malformed ones (missing patterns, unknown list refs, oversize
-- config, caps on part-list count/size), and default_naming_config() /
-- backward-compatible untyped configs still validating as "list".
-- Run with: npx supabase test db
begin;

select
  plan (12);

-- ---------------------------------------------------------------------------
-- Valid generated config
-- ---------------------------------------------------------------------------
select
  ok (
    public.is_valid_naming_config (
      '{
        "type": "generated",
        "convention": "pool",
        "parts": {
          "m_onset": ["A", "Bra", "Cor"],
          "m_coda": ["dan", "lin"]
        },
        "patterns": {
          "male_given": [["m_onset", "m_coda"]],
          "female_given": [["m_onset", "m_coda"], "a"],
          "surname": ["Of ", ["m_onset"]]
        }
      }'::jsonb
    ),
    'validator accepts a well-formed generated config'
  );

-- ---------------------------------------------------------------------------
-- Missing required pattern keys
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      '{
        "type": "generated",
        "convention": "pool",
        "parts": {"m_onset": ["A"]},
        "patterns": {
          "male_given": [["m_onset"]],
          "female_given": [["m_onset"]]
        }
      }'::jsonb
    ),
    'validator rejects a generated config missing the surname pattern'
  );

-- ---------------------------------------------------------------------------
-- Pattern references an unknown list
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      '{
        "type": "generated",
        "convention": "pool",
        "parts": {"m_onset": ["A"]},
        "patterns": {
          "male_given": [["unknown_list"]],
          "female_given": [["m_onset"]],
          "surname": [["m_onset"]]
        }
      }'::jsonb
    ),
    'validator rejects a pattern referencing an unknown list'
  );

-- ---------------------------------------------------------------------------
-- parts is not an object
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      '{
        "type": "generated",
        "convention": "pool",
        "parts": ["not", "an", "object"],
        "patterns": {
          "male_given": [],
          "female_given": [],
          "surname": []
        }
      }'::jsonb
    ),
    'validator rejects a generated config where parts is not an object'
  );

-- ---------------------------------------------------------------------------
-- A part list entry is not a string
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      '{
        "type": "generated",
        "convention": "pool",
        "parts": {"m_onset": ["A", 1]},
        "patterns": {
          "male_given": [["m_onset"]],
          "female_given": [["m_onset"]],
          "surname": [["m_onset"]]
        }
      }'::jsonb
    ),
    'validator rejects a generated config with a non-string part entry'
  );

-- ---------------------------------------------------------------------------
-- Empty list-ref group is rejected
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      '{
        "type": "generated",
        "convention": "pool",
        "parts": {"m_onset": ["A"]},
        "patterns": {
          "male_given": [[]],
          "female_given": [["m_onset"]],
          "surname": [["m_onset"]]
        }
      }'::jsonb
    ),
    'validator rejects an empty list-ref group'
  );

-- ---------------------------------------------------------------------------
-- Too many part lists (cap: 40)
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      jsonb_build_object(
        'type',
        'generated',
        'convention',
        'pool',
        'parts',
        (
          select
            jsonb_object_agg('list_' || g::text, jsonb_build_array('A'))
          from
            generate_series(1, 41) as g
        ),
        'patterns',
        jsonb_build_object(
          'male_given',
          jsonb_build_array(jsonb_build_array('list_1')),
          'female_given',
          jsonb_build_array(jsonb_build_array('list_1')),
          'surname',
          jsonb_build_array(jsonb_build_array('list_1'))
        )
      )
    ),
    'validator rejects a generated config with more than 40 part lists'
  );

-- ---------------------------------------------------------------------------
-- Too many entries in a single part list (cap: 500)
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      jsonb_build_object(
        'type',
        'generated',
        'convention',
        'pool',
        'parts',
        jsonb_build_object(
          'm_onset',
          (
            select
              jsonb_agg('name_' || g::text)
            from
              generate_series(1, 501) as g
          )
        ),
        'patterns',
        jsonb_build_object(
          'male_given',
          jsonb_build_array(jsonb_build_array('m_onset')),
          'female_given',
          jsonb_build_array(jsonb_build_array('m_onset')),
          'surname',
          jsonb_build_array(jsonb_build_array('m_onset'))
        )
      )
    ),
    'validator rejects a part list with more than 500 entries'
  );

-- ---------------------------------------------------------------------------
-- Oversize config (cap: 64KB)
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      jsonb_build_object(
        'type',
        'generated',
        'convention',
        'pool',
        'parts',
        jsonb_build_object('m_onset', jsonb_build_array(repeat('x', 70000))),
        'patterns',
        jsonb_build_object(
          'male_given',
          jsonb_build_array(jsonb_build_array('m_onset')),
          'female_given',
          jsonb_build_array(jsonb_build_array('m_onset')),
          'surname',
          jsonb_build_array(jsonb_build_array('m_onset'))
        )
      )
    ),
    'validator rejects a config larger than 64KB'
  );

-- ---------------------------------------------------------------------------
-- Unknown type value
-- ---------------------------------------------------------------------------
select
  ok (
    not public.is_valid_naming_config (
      '{"type": "unknown", "convention": "pool"}'::jsonb
    ),
    'validator rejects an unknown type value'
  );

-- ---------------------------------------------------------------------------
-- Backward compatibility: untyped config still validates as "list"
-- ---------------------------------------------------------------------------
select
  ok (
    public.is_valid_naming_config (
      '{"male_given_names":["A"],"female_given_names":["B"],"surnames":["C"],"convention":"pool"}'::jsonb
    ),
    'validator treats an untyped config as the list format'
  );

-- ---------------------------------------------------------------------------
-- default_naming_config() carries an explicit list type
-- ---------------------------------------------------------------------------
select
  is (
    public.default_naming_config () ->> 'type',
    'list',
    'default_naming_config uses the list type'
  );

select
  *
from
  finish ();

rollback;
