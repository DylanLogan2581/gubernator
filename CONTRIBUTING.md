# Contributing

This guide is for human contributors.

`AGENTS.md` is the machine-oriented working agreement. The two documents should stay aligned, but `CONTRIBUTING.md` is written for people and keeps the workflow easier to scan.

## Start Here

1. Read `README.md` for the repository overview.
2. Read this file for contribution workflow.
3. Use `AGENTS.md` only if you want the full code-placement and architecture rules spelled out.

## Local Setup

Requirements:

- Node.js 22+
- npm 10+
- Optional: Supabase CLI for local schema, auth, and migration work

Setup:

```bash
npm install
npm run dev
```

If you need Supabase in the browser app, copy `.env.example` to `.env` and set the project-specific values.

## Core Commands

- `npm run dev` starts the Vite dev server
- `npm run lint` runs code, docs, and SQL checks
- `npm run build` type-checks and builds the app
- `npm run test` runs Vitest
- `npm run preview` serves the production build locally
- `npm run release:dry` previews the next release without changing files
- `npm run release` performs a full release and pushes commit + tag

## Workflow

This template is designed to set up downstream repos with:

- Conventional Commit messages
- Conventional PR titles
- required `Lint` and `Build` checks
- CODEOWNERS review
- dependency review, workflow linting, and CodeQL

When editing the template itself, follow the maintainer or task-specific instruction if it differs from those downstream defaults.

### Commit Messages

Use lowercase conventional commits with a required scope.

Examples:

- `feat(auth): add password reset flow`
- `fix(router): handle missing route params`
- `docs(readme): clarify setup`

### Pull Requests

Keep PRs focused and easy to review.

Good PRs:

- solve one logical problem
- explain what changed and why
- describe validation clearly
- call out schema, security, and environment impact

## Release Workflow

Use an on-demand release flow.

1. Make sure your local `main` is up to date and working tree is clean.
2. Optional safety check: run `npm run release:dry`.
3. Run `npm run release`.

That single command updates `package.json`/lockfile and `CHANGELOG.md`, creates a release commit and tag, and pushes both. A pushed `v*` tag then triggers `.github/workflows/tag-release.yml` to create the GitHub Release.

## Code Expectations

The short version:

- keep route files thin
- organize reusable logic under `src/features/<feature-name>`
- use the `@/` alias for cross-layer imports inside `src`
- use local relative imports freely within the same feature when that keeps feature internals simple
- import features through public entrypoints
- keep `src/components/ui` low-level
- keep raw data access out of routes and components
- prefer TypeScript `type` imports and explicit return types
- avoid `any`, non-null assertions, and ad hoc browser side effects

If you are unsure where something belongs, check `AGENTS.md`.

## Schema and Supabase Changes

Database changes must be made through migrations, not only through the Supabase dashboard.

When schema changes:

1. Create a migration with `supabase migration new <name>`.
2. Edit the SQL in `supabase/migrations/`.
3. Include related indexes, constraints, foreign keys, RLS enablement, and policies.
4. Update generated database types if the project uses them.
5. Run `supabase db reset` when practical.

Never add an application table without RLS and appropriate policies.

## Validation

Before opening a PR, run the checks that fit your change.

Usually:

```bash
npm run lint
npm run build
```

Also run `npm run test` when tests exist for the area you changed.

This template intentionally allows an empty Vitest suite at the start so a fresh app is not forced to add placeholder tests before any real behavior exists. Once a project has meaningful logic, add tests for the changed area instead of relying on the empty-suite fallback.

## Security Expectations

Review every change for:

- authentication and authorization
- input validation
- secret handling
- data exposure
- Supabase access patterns and RLS
- privileged behavior in Edge Functions and workflows

Do not commit secrets, service-role keys, or real credentials.

## Documentation Expectations

Update docs when future contributors would otherwise be surprised.

Most common cases:

- `README.md` for setup, scripts, or project overview changes
- `CONTRIBUTING.md` for human workflow changes
- `AGENTS.md` for code organization, boundary, or agent instruction changes
- PR description notes when testing is intentionally deferred or manual validation was used
