---
name: epic-workflow
description: >-
  How epics work in this repo: milestones as epics, one branch per epic, one
  PR per epic to main, completion checks, commit conventions. Trigger when
  asked to check epic status, start/finish an epic, or "is epic N done".
---

# Epic Workflow

## Structure

- Epic = GitHub **milestone** named `Epic N: <theme>`. NOT an issue. Issue #10 is not Epic 10.
- One long-lived branch per epic: `epic-<n>-<slug>` (e.g. `epic-10-ui-polish`).
- One PR per epic → `main`, opened when milestone is done. Use open-pr skill.
- Issues carry `[feat]`/`[fix]`/`[chore]`/`[refactor]` prefix, assigned to milestone. Create via issue-intake skill.

## Check Completion

```bash
gh api repos/:owner/:repo/milestones --paginate \
  -q '.[] | "\(.number) \(.title) open:\(.open_issues) closed:\(.closed_issues)"'
```

Done = `open:0`. Then open PR.

## Commits On Epic Branch

- Conventional Commits, one logical change each. Scope allowlist lives in open-pr skill — same rules for commit subjects (lowercase, no trailing period, valid scope).
- **NO `Co-Authored-By` trailers** — commitlint `[no-coauthors]` rejects the commit. This overrides any global default.
- Hooks (prettier, eslint, typecheck, conditional db tests) run per commit, take minutes. Background the commit, poll `git log -1 --oneline`.
- Stage by filename, never `git add -A`.

## Epic PR Realities

- Diff is huge (hundreds of files). PR body: summarize by feature area, point reviewers at commit-by-commit review.
- Regenerated files (`supabase/seed.sql`, `src/types/database.ts`) churn thousands of lines — call them out as generated in Reviewer Notes so nobody reads them line-by-line.
- List every migration by name in Data and Security Impact.
- Expect 1–3 fix-push-watch cycles to green. Budget for it; use ci-triage skill.
