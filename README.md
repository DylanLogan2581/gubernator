# Web Application Template

Opinionated React + TypeScript starter for product apps that want strong structure, clear boundaries, and good behavior from both humans and coding agents.

## Stack

- Vite
- React 19
- TypeScript
- TanStack Router with file-based routes
- TanStack Query
- Tailwind CSS v4
- shadcn/ui
- Vitest
- Supabase

## What This Template Optimizes For

- Thin route files and feature-first organization
- Strict TypeScript and linting
- Clear query and infrastructure boundaries
- Supabase-ready structure with migrations and Edge Functions
- Repository automation that nudges clean PR and commit hygiene

## Using This Template

After creating a new repo from this template on GitHub:

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/YOUR_REPO.git
cd YOUR_REPO
npm install
```

### 2. Bootstrap the repo

Requires the [GitHub CLI](https://cli.github.com/) (`gh`) authenticated with your account.

```bash
npm run bootstrap:repo
```

This applies branch protection, syncs labels, rewrites template references (CODEOWNERS, config files), and copies repository settings from the source template. Run it once, right after cloning.

If your repo lives under a different org or you forked the template, pass explicit flags:

```bash
npm run bootstrap:repo -- --repo YOUR_ORG/YOUR_REPO
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Then fill in your Supabase project values:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Start developing

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Scripts

- `npm run dev` starts the Vite dev server
- `npm run build` type-checks and builds the app
- `npm run lint` runs ESLint, Markdown linting, and SQL formatting checks
- `npm run preview` serves the production build locally
- `npm run test` runs Vitest and intentionally passes when the starter has no tests yet
- `npm run bootstrap:repo` applies repo settings, branch protection, and labels after creating from the template
- `npm run release:dry` previews the next release version and changelog changes
- `npm run release` creates the release commit and tag, pushes to `main`, and triggers a GitHub Release
- `npm run prepare` installs Husky hooks

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
  features/              # feature-owned components, queries, hooks, schemas, utils
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
  migrations/            # schema history
  seed.sql               # optional deterministic seed data
```

## Template Conventions

- Keep route files small and move growing logic into `src/features`.
- Import from `src` through the `@/` alias.
- Import features through public entrypoints such as `@/features/<feature-name>`.
- Keep data access in feature query modules instead of routes and components.
- Do not edit generated files such as `src/routeTree.gen.ts` by hand.
- Treat `supabase/migrations` as the source of truth for schema changes.
- Enable Row Level Security on application tables.

## Repository Automation

This template ships automation that downstream projects can keep:

- Husky + lint-staged for pre-commit formatting and linting
- commitlint for conventional commit messages
- on-demand release flow via `npm run release` (version bump, changelog update, release commit, and tag)
- tag-triggered GitHub Release workflow (`.github/workflows/tag-release.yml`)
- GitHub Actions for lint, build, test, dependency review, workflow linting, and CodeQL
- CODEOWNERS and PR governance helpers

## Before Shipping Changes

Run the checks that fit your change:

```bash
npm run lint
npm run build
```

If you changed behavior covered by tests, also run `npm run test`.

If you changed schema, also confirm:

- a migration was added in `supabase/migrations`
- RLS and policies were updated when needed
- generated database types were updated if the project uses them
