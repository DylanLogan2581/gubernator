---
name: issue-intake
description: >-
  Turn a user-provided list of issues (bugs, features, cleanups) into detailed
  GitHub issues. Investigate the codebase in depth first — locate relevant
  file:line and root-cause each bug — then create issues with `gh` against a
  REQUIRED milestone, formatted per this repo's issue templates. Trigger when
  the user pastes a list of problems/ideas and asks to "create github issues",
  "review these issues", "make issues for these", or assign them to a
  milestone/epic.
---

# Issue Intake

Convert a raw list of issues into well-scoped, implementer-ready GitHub issues.

## 0. Require a milestone (blocking)

Never create issues without a milestone. If the user did not name one, ask. Resolve title → number:

```bash
gh api repos/:owner/:repo/milestones --jq '.[] | "\(.number) | \(.title)"'
```

"Epic N" means the milestone titled `Epic N: ...` (number may differ from N). `gh issue create --milestone` accepts the title or number.

## 1. Investigate before writing (the value step)

For each bullet, find the real code. Do not write issues from the bullet text alone.

- Fan out **`caveman:cavecrew-investigator`** agents in parallel, grouped by area (3–5 agents, one message). Ask each for a concise `file:line` table + one-line "what it does" — no fixes.
- For **bugs**, demand a root cause: the failing line, the mismatch, the missing policy. Read the 1–3 key files yourself to confirm (e.g. a schema vs payload, a query-key mismatch, an RLS/grant gap).
- For **features**, locate the schema/table, the config UI, the mutation, and (if it touches a turn) the simulation phase + insertion point. Note what already exists to reuse.
- Capture exact strings (error text, column names) — they go in the issue.

## 2. Combine / split for efficiency

Right-size, don't 1:1 the list.

- **Combine** trivial same-file/same-page edits (e.g. three "remove this subheader" trims → one cleanup issue with a checklist).
- **Keep separate** distinct concerns even on one page when they differ in type/test surface (a redesign vs a text trim vs a reorder).
- Each issue should be independently implementable and verifiable.

## 3. Write to the repo templates

Templates live in `.github/ISSUE_TEMPLATE/`. Match the **title prefix**, **labels**, and **section headings** of the matching type:

| Type                            | Title prefix  | Base labels   | Required sections                                                               |
| ------------------------------- | ------------- | ------------- | ------------------------------------------------------------------------------- |
| Bug (`bug.yml`)                 | `[fix] `      | `bug`         | Current Behavior · Expected Behavior · Reproduction Steps · Acceptance Criteria |
| Feature (`feature.yml`)         | `[feat] `     | `enhancement` | Problem or Opportunity · Proposed Change · Acceptance Criteria · Notes          |
| Refactor (`refactor.yml`)       | `[refactor] ` | —             | Current Pain · Target State · Guardrails · Acceptance Criteria                  |
| Maintenance (`maintenance.yml`) | `[chore] `    | —             | (see template)                                                                  |
| Docs (`docs.yml`)               | `[docs] `     | —             | (see template)                                                                  |

Re-read the template file if unsure of its current fields — they may change.

### Labels

Always add a `type: <fix|feat|refactor|chore|...>` and at least one `area: <scope>` label, plus the base label above. Scopes are the dropdown list in the templates (auth, worlds, turns, settlements, citizens, resources, jobs, buildings, deposits, managed-populations, trade, permissions, app, supabase, …). Verify names exist: `gh label list --limit 100`.

### Body content (what makes these good)

- Lead with root cause for bugs — quote the exact error and cite `path:line`.
- List **relevant files as `path:line`** so the implementer starts at the right spot.
- Give concrete, testable **Acceptance Criteria**.
- For schema/DB/edge work, add a one-line decisions block per repo rules: **migration · RLS/policy · DB test · typegen** (and "deterministic, no RNG" for simulation phases).
- Cross-link related/duplicate issues by number (`follow-up to #NNN`).
- Body text stays normal prose (not caveman), like commit/PR text.

## 4. Create

One `gh issue create` per issue; a bash helper keeps it clean:

```bash
M="Epic 6: Full turn transition simulation engine"
create() { gh issue create --milestone "$M" --title "$1" --label "$2" --body "$3"; }

create "[fix] Short imperative title" "type: fix,bug,area: worlds" \
'## Current Behavior
...exact error + `path:line`...

## Expected Behavior
...

## Reproduction Steps
1. ...

## Acceptance Criteria
- ...'
```

Batch all `create` calls in one Bash block. `gh` prints each new issue URL — relay them back as a compact table (number · title · root-cause note).

## Checklist

- [ ] Milestone confirmed and resolved to a number/title.
- [ ] Each bullet investigated; bugs have a confirmed root cause.
- [ ] Bullets combined/split sensibly.
- [ ] Each issue uses the right template prefix + sections + labels.
- [ ] Relevant `path:line` files listed; acceptance criteria testable.
- [ ] Schema/DB issues note migration/RLS/test/typegen.
- [ ] Issues created against the milestone; URLs reported.
