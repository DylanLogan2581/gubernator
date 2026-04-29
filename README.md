# Gubernator

A turn-based world simulation and management application. Players create and govern worlds across time, advancing turns to simulate the growth of settlements, citizens, resources, and civilizations through a structured calendar system.

**Stack:** Vite · React 19 · TypeScript · TanStack Router · TanStack Query · Tailwind CSS v4 · shadcn/ui · Vitest · Supabase

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/DylanLogan2581/gubernator.git
cd gubernator
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Then fill in your Supabase project values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

For local Supabase auth, use the local API URL and anon key from `supabase status`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key from supabase status>
```

Use only browser-safe values with the `VITE_` prefix. Do not put service-role keys, third-party secrets, or production credentials in frontend environment files.

Local Supabase Auth is configured to send email, OAuth, and recovery redirects back to the Vite dev app at `http://localhost:5173`, with `http://127.0.0.1:5173` also allowed for local browser testing.

### 3. Apply database migrations

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and a local Supabase instance running:

```bash
supabase start
supabase db reset
```

This applies all migrations in `supabase/migrations` in order and seeds the database using `supabase/seed.sql`.

The local seed creates deterministic auth users and private worlds for super-admin, owner, and denied-access checks:

| User                          | Password      | Behavior                                                                                               |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| `superadmin@gubernator.local` | `password123` | Active super admin user. Owns `Local Development World` and has an explicit `world_admins` row for it. |
| `test@gubernator.local`       | `password123` | Active normal user. Owns `Test User World`.                                                            |
| `other@gubernator.local`      | `password123` | Active normal user. Owns `Restricted Development World`.                                               |

These credentials are deterministic local seed data only. Do not use them in hosted Supabase projects or production data.

The seeded worlds are private. Super admin can see and manage all seeded worlds; each normal user can see and manage only their own private world unless an explicit access rule grants more access.

### 4. Start the dev server

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Scripts

- `npm run dev` — starts the Vite dev server
- `npm run db:types` — regenerates `src/types/database.ts` from the local Supabase database
- `npm run build` — type-checks and builds the app
- `npm run lint` — runs ESLint, Markdown linting, and SQL formatting checks
- `npm run preview` — serves the production build locally
- `npm run test` — runs Vitest
- `npm run test:db` — runs Supabase pgTAP database tests against the local Supabase database
- `npm run release:dry` — previews the next release version and changelog changes
- `npm run release` — creates the release commit and tag, pushes to `main`, and triggers a GitHub Release
- `npm run prepare` — installs Husky hooks

## Documentation Map

- `README.md`: human overview, setup, and repository tour
- `CONTRIBUTING.md`: human contribution workflow and expectations
- `AGENTS.md`: agent-only working agreement and code organization rules
- `SECURITY.md`: vulnerability reporting and security expectations

If you are contributing as a person, start here and then read `CONTRIBUTING.md`.

If you are an agent, `AGENTS.md` is the source of truth.

## Project Structure

```text
src/
  components/
    ui/                  # low-level primitives
    app/                 # app-specific shared components
    shared/              # small reusable cross-feature components
  features/
    auth/                # authentication and session management
    worlds/              # world creation and overview
    calendar/            # in-world calendar and date tracking
    turns/               # turn advancement and simulation engine
    permissions/         # role and permission management
    nations/             # nation-level governance
    settlements/         # settlement founding, growth, and governance
    citizens/            # citizen simulation and population tracking
    resources/           # resource production, consumption, and trade
    jobs/                # job assignments and labor
    buildings/           # building construction and management
    deposits/            # resource deposits and extraction
    managed-populations/ # NPC and automated population groups
    trade/               # trade routes and exchanges
    events/              # in-world event simulation
    notifications/       # player notifications
    reports/             # analytics and turn summaries
    templates/           # reusable world and entity templates
  hooks/                 # app-wide reusable hooks
  lib/                   # infrastructure and generic utilities
  routes/                # route files only
  test/                  # shared test setup and helpers
  types/                 # shared domain types
  index.css              # global theme and styles
  main.tsx               # app bootstrap

supabase/
  config.toml            # local Supabase config
  functions/             # Edge Functions
  migrations/            # schema history (source of truth for the database)
  seed.sql               # deterministic seed data
```

## Conventions

- Keep route files small; move growing logic into `src/features`.
- Import from `src` through the `@/` alias.
- Import features through public entrypoints such as `@/features/<feature-name>`.
- Keep data access in feature query modules instead of routes and components.
- Do not edit generated files such as `src/routeTree.gen.ts` by hand.
- Treat `supabase/migrations` as the source of truth for schema changes.
- Enable Row Level Security on all application tables.

## Validation

Run these before opening a pull request:

```bash
npm run lint
npm run test
npm run build
```

If you changed schema, also confirm:

- a migration was added in `supabase/migrations`
- RLS and policies were updated when needed
- local Supabase migrations and seed apply cleanly with `npx supabase db reset`
- database tests pass with `npm run test:db`
- generated database types were updated if the project uses them

`npm run test:db` runs Supabase pgTAP tests under `supabase/tests`. These tests cover auth user synchronization, permission helpers, RLS behavior for anonymous/authenticated/world-owner/world-admin/super-admin sessions, denied private world access, restricted write paths, and super-admin elevation guards.
