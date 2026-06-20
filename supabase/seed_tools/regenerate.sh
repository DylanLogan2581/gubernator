#!/usr/bin/env bash
#
# Regenerates supabase/seed.sql for the Aldermoor demo world.
#
# The committed seed.sql is a deterministic pg_dump of a single world that was
# advanced 32 turns through the real end-turn simulation. This script reproduces
# that world end to end so the seed can be rebuilt after schema or balance
# changes instead of being hand-edited.
#
# Flow:
#   1. build_world.sql  — wipe + author the turn-0 world: 3 nations, 6
#                         settlements, 3 culture namesets, a self-sufficient
#                         food/water/craft/herding economy, ~220 NPCs named from
#                         the namesets, resource deposits, managed populations
#                         and citizen assignments.
#   2. play             — advance 32 turns through the end-turn-simulation edge
#                         function, applying organic manager interventions
#                         (a drought, a blight, a longhouse fire, a ratified
#                         trade route and a non-aggression pact) so the history
#                         shows births, deaths and varying resource flows.
#   3. cleanup.sql      — tidy the turn-32 snapshot: full staffing across all six
#                         assignment types, the readiness matrix, active trade
#                         routes, restocked herds and topped-up survival stores.
#   4. dump + assemble  — strip the turn-current baseline snapshots (the baseline
#                         backfill below re-creates them), pg_dump the public
#                         tables and splice them, resources first, into seed.sql
#                         between the hand-authored auth block (auth_users.sql)
#                         and the baseline backfill (baseline.sql), wrapped in
#                         session_replication_role = replica.
#
# Requires a running local stack (`npx supabase start`) whose seeded auth users
# (superadmin@gubernator.local / password123 etc.) already exist — run
# `npx supabase db reset` once first. Then, from the repo root:
#
#   bash supabase/seed_tools/regenerate.sh
#
# followed by `npx supabase db reset && npx supabase test db` to verify.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
API="http://127.0.0.1:54321"
# Well-known local-dev anon key (shared JWT secret; matches integration tests).
ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
W=00000000-0000-0000-0000-000000000101
TURNS=32
export PGPASSWORD=postgres
q() { psql "$DB" -tAc "$1"; }

echo "[1/4] building the turn-0 world"
psql "$DB" --single-transaction -v ON_ERROR_STOP=1 -f "$HERE/build_world.sql" >/dev/null

echo "[2/4] playing $TURNS turns through the simulation"
TOKEN=$(curl -s "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" \
  -H 'content-type: application/json' \
  -d '{"email":"superadmin@gubernator.local","password":"password123"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
FIELD=00000000-0000-0000-0005-000000000101
WATER=00000000-0000-0000-0005-000000000102
S302=00000000-0000-0000-0000-000000000302
S304=00000000-0000-0000-0000-000000000304
setstock() { q "update public.settlement_resource_stockpiles s set quantity=$3 from public.resources r where r.id=s.resource_id and r.world_id='$W' and r.slug='$2' and s.settlement_id='$1'" >/dev/null; }
fire() { q "delete from public.citizen_assignments a using public.citizens c where a.citizen_id=c.id and c.settlement_id='$1' and a.job_id='$2'" >/dev/null; }
rehire() { q "insert into public.citizen_assignments(citizen_id,assignment_type,job_id,assigned_on_turn_number) select c.id,'standard_job','$2',$3 from public.citizens c where c.settlement_id='$1' and c.citizen_type='npc' and c.status='alive' and c.born_on_turn_number<=-16 and c.id not in (select citizen_id from public.citizen_assignments) limit $4" >/dev/null; }

while :; do
  CUR=$(q "select current_turn_number from public.worlds where id='$W'")
  [ "$CUR" -ge "$TURNS" ] && break
  case "$CUR" in
    4)  setstock "$S302" fresh-water 16; fire "$S302" "$WATER"; echo "    t$CUR drought: Wendlin wells run dry" ;;
    5)  rehire "$S302" "$WATER" "$CUR" 8; echo "    t$CUR Wendlin wells reopened" ;;
    8)  q "update public.trade_routes set status='active',origin_approval_status='approved',destination_approval_status='approved',origin_approved_by_citizen_id='00000000-0000-0000-0000-000000000402',destination_approved_by_citizen_id='00000000-0000-0000-0000-000000000412' where id='00000000-0000-0000-000e-000000000102'" >/dev/null; echo "    t$CUR trade route Bramhollow->Carrick ratified" ;;
    11) q "select set_config('app.skip_bilateral_mirror','true',false); update public.nation_relationships set current_stance='non_aggression_pact',pending_stance=null,pending_status='accepted' where id='00000000-0000-0000-0000-000000000605'; insert into public.nation_relationships(from_nation_id,to_nation_id,world_id,current_stance) values('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000202','$W','non_aggression_pact') on conflict (from_nation_id,to_nation_id) do update set current_stance='non_aggression_pact'; select set_config('app.skip_bilateral_mirror','false',false);" >/dev/null; echo "    t$CUR Caldhaven<->Carrowmoor non-aggression pact signed" ;;
    13) setstock "$S304" food 24; fire "$S304" "$FIELD"; echo "    t$CUR blight ruins the Saltmere fields" ;;
    14) rehire "$S304" "$FIELD" "$CUR" 10; echo "    t$CUR Saltmere fields replanted" ;;
    18) q "update public.settlement_buildings set state='suspended' where id='00000000-0000-0000-000a-000000000505'" >/dev/null; echo "    t$CUR a longhouse fire leaves Cobbleford overcrowded" ;;
    24) q "update public.settlement_buildings set state='active' where id='00000000-0000-0000-000a-000000000505'" >/dev/null; echo "    t$CUR Cobbleford longhouse rebuilt" ;;
  esac
  curl -s "$API/functions/v1/end-turn-simulation" -H 'content-type: application/json' \
    -H "authorization: Bearer $TOKEN" \
    -d "{\"worldId\":\"$W\",\"expectedTurnNumber\":$CUR}" \
    | python3 -c '
import sys, json
d = json.load(sys.stdin)
if not d.get("ok"):
    print("ERR", json.dumps(d)[:300]); sys.exit(1)
s = d["data"]["summary"]
print("    turn %s->%s (births %s deaths %s)" % (s["fromTurnNumber"], s["toTurnNumber"], s["patchCounts"]["citizenBirths"], s["patchCounts"]["citizenDeaths"]))'
done

echo "[3/4] tidying the turn-$TURNS snapshot"
psql "$DB" -v ON_ERROR_STOP=1 -f "$HERE/cleanup.sql" >/dev/null

echo "[4/4] dumping and assembling seed.sql"
q "delete from public.settlement_turn_resource_snapshots where turn_transition_id is null; delete from public.settlement_turn_snapshots where turn_transition_id is null;"
TABLES="worlds namesets resources job_definitions building_blueprints building_blueprint_tiers deposit_types managed_population_types nations settlements citizens nation_relationships partnerships settlement_resource_stockpiles deposit_instances deposit_instance_resources managed_population_instances construction_projects settlement_buildings trade_routes trade_route_legs citizen_assignments world_admins user_active_player_characters turn_transitions turn_log_entries notifications settlement_turn_snapshots settlement_turn_resource_snapshots"
TFLAGS=""
for t in $TABLES; do TFLAGS="$TFLAGS -t public.$t"; done
# shellcheck disable=SC2086
pg_dump "$DB" --data-only --column-inserts --no-owner --no-privileges --no-comments $TFLAGS > "$HERE/world_data.sql"

DATA="$HERE/world_data.sql" AUTH="$HERE/auth_users.sql" BASE="$HERE/baseline.sql" OUT="$ROOT/supabase/seed.sql" python3 - << 'PYEOF'
import os, re
order = ['worlds','resources','job_definitions','deposit_types','managed_population_types',
 'building_blueprints','building_blueprint_tiers','namesets','nations','settlements','citizens',
 'nation_relationships','partnerships','settlement_resource_stockpiles','deposit_instances',
 'deposit_instance_resources','managed_population_instances','construction_projects',
 'settlement_buildings','trade_routes','trade_route_legs','citizen_assignments','world_admins',
 'user_active_player_characters','turn_transitions','turn_log_entries','notifications',
 'settlement_turn_snapshots','settlement_turn_resource_snapshots']
groups = {t: [] for t in order}
pat = re.compile(r'^INSERT INTO public\.(\w+) ')
for line in open(os.environ['DATA']):
    if line.startswith('INSERT INTO public.'):
        groups[pat.match(line).group(1)].append(line.rstrip('\n'))
hdr = ['', '-- ' + '=' * 73, '-- Aldermoor demo world.', '--',
 '-- A single, richly populated world (3 nations, 6 settlements, ~290 citizens',
 '-- named from culture namesets, a self-sufficient food/water/craft/herding',
 '-- economy with resource deposits and managed populations) that was advanced 32',
 '-- turns through the real end-turn simulation, then tidied into a clean,',
 '-- fully-managed turn-32 snapshot. Regenerate with supabase/seed_tools.',
 '--',
 '-- Generated pg_dump (--column-inserts) of the public application tables,',
 '-- loaded with triggers, RLS and FK checks disabled (session_replication_role',
 '-- = replica) so the rows load verbatim. Tables are emitted resources-first so',
 '-- the cross-table JSON CHECK validators (NOT disabled by replica mode) see',
 '-- their referenced resources/jobs. The turn-current baseline snapshots are',
 '-- created by the backfill block at the end. auth.users / public.users are',
 '-- handled above. Excluded from Prettier (see .prettierignore).',
 '-- ' + '=' * 73, 'set session_replication_role = replica;', '']
tail = list(hdr)
for t in order:
    if groups[t]:
        tail.append(f"-- {t} ({len(groups[t])} rows)")
        tail.extend(groups[t])
        tail.append("")
tail.append('set session_replication_role = default;')
auth = open(os.environ['AUTH']).read().rstrip('\n')
baseline = open(os.environ['BASE']).read().rstrip('\n')
open(os.environ['OUT'], 'w').write(auth + '\n' + '\n'.join(tail) + '\n' + baseline + '\n')
print('    wrote seed.sql:', sum(len(g) for g in groups.values()), 'data rows')
PYEOF

rm -f "$HERE/world_data.sql"
echo "done. Verify with: npx supabase db reset && npx supabase test db"
