---
name: ci-triage
description: >-
  Diagnose and fix a failing CI check on a PR fast: get raw check states,
  read only failing log lines, map each check name to its fix, know which
  failures hide other failures. Trigger when CI is red, a check fails, or
  user says "fix the build/checks".
---

# CI Triage

## Read State, Not Noise

```bash
gh pr view <num> --json statusCheckRollup \
  --jq '.statusCheckRollup[] | "\(.name // .context): \(.conclusion // .state)"' | sort -u

gh pr view <num> --json statusCheckRollup \
  --jq '.statusCheckRollup[] | select(.conclusion=="FAILURE") | .detailsUrl'

gh run view --job <jobId> --log-failed 2>/dev/null | grep -aiE "fail|error|does not meet|not ok|expected" | head -20
```

Logs have ANSI escapes — grep with `-a`, filter hard, never dump raw log into context.

## Check → Fix Map

| Check             | Runs                                         | Fix                                                                                                       |
| ----------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Validate PR Title | commitlint on title                          | lowercase subject, valid scope, no trailing period. `gh pr edit <num> --title` re-runs it, no push needed |
| Deno              | `deno lint` THEN `deno fmt --check`          | see edge-functions skill. Lint failure MASKS fmt failure — always run both locally                        |
| Lint / Build      | `npm run lint` / `npm run build`             | reproduce locally                                                                                         |
| Test              | full vitest + coverage thresholds            | test failure vs threshold failure are different animals — read which. See test-hygiene skill              |
| Database          | pgTAP + integration tests on fresh seeded DB | `npx supabase db reset && npx supabase test db` locally FIRST — stale DB hides what CI sees               |

## Triage Judgment

- **Sequential steps mask each other**: one green push can reveal a new failure in the next step of the same job. Not regression — layer you couldn't see. Fix, push, watch again.
- **Passed before, fails now, passes locally** = flake. Fix the race in the test (findBy vs getBy), don't just rerun.
- **Never passed in CI** = real bug. Chase the thrown message to root cause.
- Same test failing twice in CI is NOT proof of determinism if runs share timing conditions — still check for race first.
- Watch checks in background: `gh pr checks <num> --watch --interval 60` via background task. Don't block; report when done.

## Push Loop

Fix → commit (hooks take minutes, background it) → push → watch → repeat. Each iteration: fix ALL currently-visible failures before pushing, and preempt masked layers you can check locally (deno fmt after deno lint, coverage after tests).
