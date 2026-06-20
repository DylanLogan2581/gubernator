# Deployment Runbook

Step-by-step guide to bring up a fresh Gubernator environment from scratch.
Covers local development and production (hosted Supabase) deployments.

## Prerequisites

- [Node.js](https://nodejs.org/) (see `.nvmrc` for the required version)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase` or Homebrew)
- [Docker](https://www.docker.com/) — required for the local Supabase stack
- A Supabase project for staging/production (create one at
  [supabase.com/dashboard](https://supabase.com/dashboard))

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Configure environment variables

Copy the example file and fill in the values for your target environment:

```bash
cp .env.example .env
```

### Frontend variables (`.env`)

| Variable                 | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Project API URL, e.g. `https://<project-id>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Project anon/public key                                  |

For **local development**, these are printed by `supabase start`:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
```

### SMTP variables (email delivery)

Magic-link authentication requires an SMTP relay. See the `SUPABASE_SMTP_*`
block in `.env.example` for all variables.

- **Local**: leave defaults — the local stack includes
  [Inbucket](http://localhost:54324) for catch-all email inspection.
- **Production**: replace with your provider's credentials (SendGrid, Postmark,
  Resend, etc.).

### Edge function CORS secrets

Two edge functions require a per-function CORS origin allowlist:

| Variable                                | Function                | Default (local)                                      |
| --------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `END_TURN_SIMULATION_ALLOWED_ORIGINS`   | `end-turn-simulation`   | `http://localhost:5173,http://127.0.0.1:5173`        |
| `ADMIN_CREATE_USER_ALLOWED_ORIGINS`     | `admin-create-user`     | `http://localhost:5173,http://127.0.0.1:5173`        |
| `EXPORT_WORLD_TEMPLATE_ALLOWED_ORIGINS` | `export-world-template` | _(optional — unset allows non-browser clients only)_ |

Format: comma-separated origins, scheme + host, no path, no trailing slash.

**Local**: already set in `supabase/config.toml` under `[edge_runtime.secrets]`.
No action needed unless you change the Vite dev server port.

**Production**: set them as Supabase secrets (see [§5 Deploy edge
functions](#5-deploy-edge-functions)).

### Edge function required env vars (auto-injected by Supabase)

Each edge function validates these at cold start via `assertEdgeEnvVars` in
`supabase/functions/_shared/http/env.ts`. Supabase injects them automatically —
you do not set them manually.

| Variable                    | Used by                                    |
| --------------------------- | ------------------------------------------ |
| `SUPABASE_URL`              | all functions                              |
| `SUPABASE_ANON_KEY`         | all functions                              |
| `SUPABASE_SERVICE_ROLE_KEY` | `end-turn-simulation`, `admin-create-user` |

If a required variable is missing at cold start, the function throws immediately
with `"Edge function cold-start failed — missing required env vars: ..."`.

---

## 3. Apply migrations (local)

Start the local Supabase stack (requires Docker):

```bash
supabase start
```

Apply all migrations and seed the database:

```bash
supabase db reset
```

`db reset` replays every file in `supabase/migrations/` in chronological order,
then runs `supabase/seed.sql` to create deterministic test users and worlds.

After any migration change, regenerate the TypeScript database types:

```bash
npm run db:types
```

Skipping `db:types` after a schema change will leave `src/types/database.ts`
stale and cause build failures.

---

## 4. Apply migrations (production)

Push pending migrations to the hosted Supabase project:

```bash
supabase db push --project-ref <project-ref>
```

Where `<project-ref>` is the short ID shown in your Supabase project URL
(`https://supabase.com/dashboard/project/<project-ref>`).

Run `db:types` and rebuild if you are deploying a frontend alongside a schema
change:

```bash
npm run db:types
npm run build
```

---

## 5. Deploy edge functions

Deploy all three edge functions:

```bash
supabase functions deploy end-turn-simulation --project-ref <project-ref>
supabase functions deploy export-world-template --project-ref <project-ref>
supabase functions deploy admin-create-user --project-ref <project-ref>
```

Set the CORS origin secrets for production:

```bash
supabase secrets set --project-ref <project-ref> \
  END_TURN_SIMULATION_ALLOWED_ORIGINS="https://app.example.com" \
  ADMIN_CREATE_USER_ALLOWED_ORIGINS="https://app.example.com"
```

Replace `https://app.example.com` with your deployed frontend origin. Multiple
origins are comma-separated. If these are unset, browser requests will be
rejected with HTTP 403.

---

## 6. Start the dev server (local only)

```bash
npm run dev
```

App runs at `http://localhost:5173`.

---

## Local vs production differences

| Concern           | Local                                           | Production                                  |
| ----------------- | ----------------------------------------------- | ------------------------------------------- |
| Supabase stack    | `supabase start` (Docker)                       | Hosted project                              |
| Migrations        | `supabase db reset`                             | `supabase db push`                          |
| Seed data         | Auto-applied by `db reset`                      | Not applied                                 |
| SMTP              | Inbucket (port 54324)                           | External SMTP provider                      |
| CORS secrets      | `supabase/config.toml` `[edge_runtime.secrets]` | `supabase secrets set`                      |
| Frontend URL      | `http://localhost:5173`                         | Deployed hosting URL                        |
| Anon/service keys | Printed by `supabase start`                     | Supabase dashboard → Project Settings → API |

---

## Verification checklist

After standing up a fresh environment:

- [ ] `supabase status` shows all services healthy
- [ ] App loads at the configured URL and shows the sign-in page
- [ ] Magic-link sign-in delivers an email (Inbucket locally, inbox in production)
- [ ] A superadmin user can reach `/superadmin/` and see the settings page
- [ ] End turn completes without error on a test world
- [ ] `npm run test:db` passes against the local database
