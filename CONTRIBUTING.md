# Contributing

This guide is for human contributors to Gubernator.

`AGENTS.md` is the machine-oriented working agreement. The two documents should stay aligned, but `CONTRIBUTING.md` is written for people and keeps the workflow easier to scan.

## Start Here

1. Read `README.md` for the repository overview.
2. Read this file for contribution workflow.
3. Use `AGENTS.md` only if you want the full code-placement and architecture rules spelled out.

## Local Setup

Requirements:

- Node.js 22+
- npm 10+
- Supabase CLI for local schema, auth, and migration work

Setup:

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set the Supabase project values before starting the dev server.

For local Supabase auth work, start Supabase and copy the local API URL and anon key from `supabase status`:

```bash
supabase start
supabase status
```

Your local `.env` should use the local API URL and local anon key:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key from supabase status>
```

Never put service-role keys, third-party secrets, or production credentials in frontend environment files.

## Core Commands

- `npm run dev` starts the Vite dev server
- `npm run lint` runs code, docs, and SQL checks
- `npm run build` type-checks and builds the app
- `npm run test` runs Vitest
- `npm run preview` serves the production build locally
- `npm run release:dry` previews the next release without changing files
- `npm run release` performs a full release and pushes commit + tag

## Workflow

Gubernator uses:

- Conventional Commit messages
- Conventional PR titles
- required `Lint` and `Build` checks
- CODEOWNERS review
- dependency review, workflow linting, and CodeQL

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

### Local Auth and Seeded Access

`supabase db reset` applies migrations and then loads `supabase/seed.sql`. The seed creates local-only confirmed email users and private worlds for access testing:

| User                          | Password      | Behavior                                                                                               |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `superadmin@gubernator.local` | `password123` | Active super admin user. Owns `Local Development World` and has an explicit `world_admins` row for it. |
| `test@gubernator.local`       | `password123` | Active normal user. Owns `Test User World`.                                                            |
| `other@gubernator.local`      | `password123` | Active normal user. Owns `Restricted Development World`.                                               |

The seeded credentials are local fixtures only. Do not reuse them in hosted Supabase projects or production data.

Expected local access behavior:

- super admin can see and manage all seeded worlds
- each normal user can see and manage their own private world
- normal users cannot see another user's private world unless an explicit access rule grants it
- anonymous users cannot read application user, world, or world admin rows through RLS

Protected app areas such as `/worlds` and `/worlds/$worldSlug` require an authenticated Supabase session. Unauthenticated visitors are redirected to `/sign-in` with a return path. After sign-in, the app combines the current user row and world admin rows into an access context; world lists show only accessible worlds, and unavailable or unauthorized world routes show the shared access-denied state.

## Validation

Before opening a PR, run the checks that fit your change.

Usually:

```bash
npm run lint
npm run test
npm run build
```

For auth, permission, RLS, or schema work, also run:

```bash
supabase db reset
npm run test:db
```

`npm run test:db` runs Supabase pgTAP tests under `supabase/tests`. The current database tests cover auth user synchronization, permission helpers, RLS behavior for anonymous users, authenticated users, world owners, world admins, and super admins, denied access to private worlds, restricted write paths, and super-admin elevation guards.

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
