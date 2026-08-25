# New Client Setup

This repo is a template: fork it once per client, each with its own database
and deployment. Do not run one shared multi-tenant deployment across clients.

## 1. Fork the repo

Create a new repo for the client from this template (GitHub "Use this
template", or clone + reset git history). Never carry another client's `.env`,
seed data, or git history into the new repo.

## 2. Provision a VPS

Any small Linux VPS with Docker + Docker Compose installed is sufficient.
Point a DNS A record for the client's domain at the VPS before step 6.

## 3. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`:

- `POSTGRES_PASSWORD` — fresh, unique to this deployment
- `SESSION_SECRET` and `API_KEY_ENCRYPTION_KEY` — generate fresh values, e.g. `openssl rand -hex 32`. Never reuse across clients.
- `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — fresh MinIO credentials
- `DOMAIN` — the client's domain (must match DNS from step 2)
- `INITIAL_ORG_NAME`, `INITIAL_ORG_ACCENT_COLOR`, `INITIAL_ORG_SIDEBAR_COLOR` — the client's branding (can also be changed later via the admin UI)
- `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` — first login for the client's super admin; **change the password on first login**
- LLM provider keys — can be left blank and set later via Admin → API Keys

## 4. Build and start

```bash
docker compose up -d --build
```

This builds the app image, starts Postgres and MinIO, runs the `migrate`
one-shot container, then starts `app`, `worker`, `chat-ws`, and `caddy`. The
`worker` service processes background AI jobs (research, email generation,
call-pitch generation) — nothing else to configure, it starts automatically.

## 5. Seed the client's data

The `app` service runs the minimal production image and has neither
devDependencies nor source files, so seeding runs as a one-off container
from the `migrate` service's image instead:

```bash
docker compose run --rm migrate npm run seed:client
```

This creates exactly one organization and one super-admin account from the
`INITIAL_ORG_*` / `INITIAL_ADMIN_*` values in `.env`. **Never run `seed:demo`
against a client deployment** — that seed is generic showcase sample data
for sales-pitch demos only.

## 6. First login

1. Visit `https://<client-domain>` and confirm Caddy issued a valid TLS certificate.
2. Log in as the seeded super admin and change the password immediately.
3. Set/confirm branding (logo, colors, company name) via the admin UI if not fully set via env.
4. Configure ICP fields for the client's actual sales process (Phase 2+).
5. Add LLM provider API keys via Admin → API Keys (encrypted at rest immediately).

## 7. Smoke test

- Create a lead manually.
- Confirm the dashboard reflects real data, not the demo placeholders.
- Trigger research/enrichment on a lead and confirm the background worker processes it (check `docker compose logs worker` if it doesn't complete within a few seconds).

## 8. Clean up

- Rotate or remove any credentials that were only used for setup convenience.
- Confirm `.env` is not committed (`.gitignore` already excludes `.env*` except `.env.example`).

## Keeping the client fork up to date

As the template repo receives updates, periodically merge or cherry-pick
relevant changes into each client fork. Once there are several client forks,
settle on one workflow (merge vs. rebase) and stick to it — see the base
template's own docs for the current recommendation.
