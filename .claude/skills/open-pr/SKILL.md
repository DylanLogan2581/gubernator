---
name: open-pr
description: >-
  Open a pull request from the current branch to main with the `gh` CLI, then
  drive its CI checks to green. Fills the repo PR template, writes a
  commitlint-valid title, and knows how to diagnose and fix the Validate PR
  Title, Deno, Database, Lint, Build, and Test checks. Trigger when the user
  asks to "open a PR", "raise a PR", "create a pull request", "PR this branch
  to main", or wants checks watched until they pass.
---

# Open PR

Open a PR from the current branch to `main` and get every check green.

## 0. Preflight

```bash
git branch --show-current          # confirm not on main
git log main..HEAD --oneline       # commits that will ship
git status -sb                     # uncommitted work + ahead/behind
git diff main...HEAD --stat | tail -40
```

- If the branch is behind `origin/<branch>`, push first or the PR diff is stale.
- Read the diff stat. The PR body must describe what is actually in the branch,
  not what you assume. Note any `supabase/migrations/**` changes — they trigger
  the Database check and the schema-change checklist (AGENTS.md).
- Only commit/push uncommitted changes if the user asked. Untracked files in the
  working tree may be the user's in-progress work — confirm before including.

## 1. Title format (the Validate PR Title check)

CI runs commitlint on the PR title. It WILL fail the check, not just warn.

- **Conventional Commits**: `type(scope): subject`
- **Subject must be lowercase.** No proper-noun capitals. `Aldermoor` fails →
  reword (`demo world` not `Aldermoor`). This is the most common miss.
- **No trailing period** on the subject.
- **Scope must be in the allowlist.** Invalid scope = hard fail. `reporting` is
  NOT valid; `reports` is. Allowed scopes:

  ```
  auth, worlds, turns, calendar, permissions, nations, settlements, citizens,
  resources, jobs, buildings, deposits, managed-populations, trade, events,
  notifications, reports, templates, app, ci, config, deps, docs, home, repo,
  supabase, testing, tooling
  ```

- Pick the scope that best matches the dominant change. Cross-cutting epic →
  pick the headline area (e.g. `reports`), or `app`.

Fix a bad title without re-pushing: `gh pr edit <num> --title "..."` then the
check re-runs.

## 2. Body format (repo PR template)

`.github/pull_request_template.md` has fixed sections. Fill them; keep the
checkbox structure. Sections: **Summary**, **Changes** (bullets),
**Validation** (checkboxes + notes), **Data and Security Impact** (checkboxes +
notes), **Documentation** (checkboxes), **Reviewer Notes**.

- Check only boxes that are true. Don't claim `npm run lint`/`npm run build` ran
  if you didn't run them — note CI runs them instead.
- Schema/migration present → check "Schema/migration change included" and
  "Auth, permission, or data exposure impact reviewed", and list the migrations.
- Write the body to a temp file, pass with `--body-file`, so markdown/heredoc
  formatting survives.

```bash
gh pr create --base main --head "$(git branch --show-current)" \
  --title "type(scope): lowercase subject" --body-file /tmp/pr_body.md
```

## 3. Watch checks

```bash
gh pr checks <num> --watch --interval 30
```

If output is hard to parse (token-filter proxies collapse it), get raw state:

```bash
gh pr view <num> --json statusCheckRollup \
  --jq '.statusCheckRollup[] | "\(.name // .context): \(.conclusion // .state)"' | sort -u
```

For a failing job, read only the failing lines:

```bash
gh run view --job <jobId> --log-failed 2>/dev/null | tail -40
# scenario/integration failures: grep for the assertion or thrown message
gh run view --job <jobId> --log-failed 2>/dev/null \
  | grep -iE "fail|error|not ok|expected|privilege|violates|constraint" | head
```

## 4. Check-specific fixes

- **Deno** (`deno fmt --check`): edge function files under `supabase/functions/`
  are formatted by Deno, not Prettier. `deno` may not be on PATH locally — use
  `npx -y deno@latest fmt supabase/functions/`. It rewrites in place; re-stage.
- **Lint / Build / Test**: standard `npm run lint`, `npm run build`,
  `npm run test`. Reproduce locally before pushing.
- **Database**: runs `npx supabase test db` (pgTAP) AND the vitest integration
  tests against a freshly seeded local DB. To reproduce CI exactly:

  ```bash
  npx supabase db reset            # applies migrations + loads seed.sql
  npx supabase test db             # pgTAP
  VITEST_INTEGRATION=true npx vitest run \
    supabase/functions/end-turn-simulation/integration.test.ts \
    src/features/worlds/scenarios/integration.test.ts
  ```

  A stale local DB hides failures — always `db reset` first so the new seed and
  any new migration are loaded. CI always starts clean.

## 5. Commit hygiene (husky hooks block commits)

These hooks reject commits outright — plan for them:

- **commit-msg / commitlint**: same rules as the PR title. Subject lowercase, no
  trailing period, valid scope. **`Co-Authored-By` trailers are forbidden**
  (`[no-coauthors]`) — do NOT add them in this repo, even though it's a global
  default elsewhere.
- **pre-commit (lint-staged)**: runs prettier --write, eslint --fix, typecheck,
  and — when edge functions or schema/test files are staged — edge typecheck and
  `supabase test db`. It does NOT `db reset` first, so reset the local DB before
  committing schema/seed changes or the DB tests fail on stale data.
- Commits run these hooks and can take minutes. Run them in the background and
  poll `git log -1 --oneline` / the task output rather than blocking.

## 6. Schema-change checklist (AGENTS.md)

If the branch touches `supabase/migrations/**`, the PR must account for:
migration included, RLS/policy decision, DB test decision, typegen decision.

- Function-body-only changes with unchanged signatures need no typegen
  (`src/types/database.ts` won't differ).
- When fixing a failing test exposes a real product bug (e.g. a teardown that
  can't delete its fixtures), fix the root cause in a migration rather than
  papering over the test. Verify with `db reset` + `supabase test db`.

## Gotchas seen in practice

- A new integration test that never passed in CI is a real bug to fix, not a
  flake — chase the thrown message.
- Service-role Supabase clients bypass RLS but carry no `auth.uid()`, so RPCs
  that authorize via `is_super_admin()` / `is_world_admin()` fail with
  `42501 insufficient privilege`. Use an authenticated client for those calls.
- `hard_delete_world` (and similar full-cascade deletes) can trip BEFORE-DELETE
  referential-integrity guards mid-cascade; the established fix is a
  transaction-local `set_config('app.<flag>', 'true', true)` that the guard
  trigger early-returns on.
- When redefining an existing SQL function in a new migration, copy from the
  LATEST migration that defined it, not the original — columns get renamed
  (`is_deleted`/`is_active` → `is_trashed`) and the old body will reference dead
  columns.
