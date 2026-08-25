# Sales Intelligence System

A multi-user B2B sales intelligence and pipeline CRM: lead management, an
AI-driven scoring/focus-queue engine, and AI-assisted research/email/call-pitch
generation. Built as a reusable **base template** — fork it per client (see
[NEW-CLIENT-SETUP.md](./NEW-CLIENT-SETUP.md)) rather than running one shared
multi-tenant deployment.

This repo replaces an earlier PHP/vanilla-JS/shared-hosting version of the
same product. In short: the old stack couldn't scale past a handful of users,
stored everything as JSON blobs in Postgres instead of a real relational
schema, ran LLM calls synchronously (5–30s blocking requests), and depended
on a third-party realtime service (Pusher) purely because shared hosting
couldn't run a persistent process.

## Stack

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **PostgreSQL** via **Drizzle ORM** — a real relational schema, not a KV store
- **Custom session-based auth** (httpOnly cookies, server-side sessions) — supports admin impersonation as a first-class, audited feature
- **pg-boss** for background jobs (runs inside Postgres — no separate Redis service)
- **Tailwind CSS v4 + shadcn/ui (Radix)** — fully custom, config-driven design system
- **Docker Compose** deployment: `app`, `worker`, `postgres`, `minio`, `caddy` (auto-HTTPS)

## Local development

Requires Docker (for Postgres/MinIO) or a local Postgres instance.

```bash
cp .env.example .env
# fill in .env — see comments in the file

npm install
npm run db:migrate
npm run seed:demo   # generic showcase demo data, for local dev / sales demos
# or: npm run seed:client   # minimal org + admin, for a real deployment

npm run dev
```

Demo login (after `seed:demo`), all with password `demo1234`:
`superadmin@salesintel.demo`, `admin@salesintel.demo`, `rep@salesintel.demo`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` / `npm run start` | Production build / start |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run db:generate` | Generate a Drizzle migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Drizzle Studio (DB browser) |
| `npm run seed:demo` | Seed generic showcase demo data (dev/showcase only) |
| `npm run seed:client` | Seed a minimal org + super-admin (real deployments) |

## Deployment

See [NEW-CLIENT-SETUP.md](./NEW-CLIENT-SETUP.md) for the full per-client
deployment checklist. Short version: `docker compose up -d --build` on a VPS
with `.env` configured builds the app, runs migrations, and starts everything
behind Caddy with automatic TLS.

## Project structure

```
src/
  app/
    (auth)/            # login, session Server Actions
    (dashboard)/        # authenticated shell — sidebar, dashboard, leads, etc.
  components/
    ui/                 # shadcn/ui primitives
    layout/              # sidebar, topbar
    dashboard/, leads/   # domain components
  lib/
    db/                  # Drizzle schema, client, seed scripts
    auth/                # sessions, password hashing, impersonation
    config/              # branding/theme config loader
    validation/          # Zod schemas
```

## Status

**Phase 0 complete**: scaffold, auth (with impersonation), design system,
dashboard shell with realistic demo data. Leads CRUD, the scoring engine,
AI features, and admin/reports land in subsequent phases. Chat, Aircall
calling, and support tickets are intentionally out of scope for this build.
