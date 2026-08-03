---
name: test-hygiene
description: >-
  Write vitest tests that pass in CI, satisfy per-directory coverage
  thresholds, and don't flake. Trigger when adding tests, when the Test CI
  check fails, when coverage thresholds fail, or when a test passes locally
  but fails in CI.
---

# Test Hygiene

## Coverage Thresholds Are Hard Gates

CI runs `npm run test:coverage` with per-directory thresholds in `vitest.config.ts` (e.g. `src/shared/simulation/**` needs 90% lines/functions/statements, 85% branches). New file in a thresholded dir drags the whole dir down — 620 untested lines tanked a green suite once. Ship code + tests together.

Check locally what CI sees:

```bash
npx vitest run --coverage <dir>
node -e "const s=require('./coverage/coverage-summary.json');
for (const [k,v] of Object.entries(s)) if (k.includes('<dir>'))
  console.log(k, v.lines.pct, v.functions.pct, v.branches.pct)"
```

## Branch Coverage Cheap Trick

Guard-heavy parsers/validators: don't hand-write a failing case per field. Loop:

```ts
function expectNullPerInvalidField(parse, valid) {
  for (const key of Object.keys(valid)) {
    const { [key]: _omitted, ...missing } = valid;
    expect(parse(missing)).toBeNull();
    expect(parse({ ...valid, [key]: true })).toBeNull(); // wrong type for string AND number
  }
}
```

Hits both sides of every guard branch. Add specific cases only for unions, enums, optional fields.

## Flake Rules (passes local, fails CI)

- After navigation or mutation, first query for async content = `findBy*`, never `getBy*`. CI is slower; `getByText` right after `findByRole` races the second render. One awaited element does NOT prove siblings rendered — different queries resolve at different times.
- `waitFor` for router state (`router.state.location.pathname`), then STILL `findBy` for content.
- "Unable to find element" in CI + passing locally = race, not missing element. Fix the await, don't rerun and hope.
- act() warnings in output are smell — state updating after test moved on. Usually same root cause.

## Running

- `npm run test` full suite; `npx vitest run <path>` single file.
- Integration tests need `VITEST_INTEGRATION=true` and fresh DB (`npx supabase db reset` first).
- Worker forks capped at 4 locally (`VITEST_MAX_FORKS` overrides) — don't "fix" slow suites by raising it in config.
