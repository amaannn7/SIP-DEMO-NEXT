# VPS Hosting Guide — Sales Intelligence CRM

**Prepared for:** Levata HQ internal use
**Date:** August 18, 2026
**Scope:** Server sizing and provider pricing for hosting client deployments of the Sales Intelligence CRM

---

## 1. How this app is actually deployed

Per [NEW-CLIENT-SETUP.md](NEW-CLIENT-SETUP.md), this is **not** a single shared multi-tenant server. The deployment model is:

> Fork the repo once per client, each with its own database and deployment. Do not run one shared multi-tenant deployment across clients.

So "handling many clients" means **one small VPS per client**, not one giant server. Each VPS runs the full Docker Compose stack independently:

| Service | Role |
|---|---|
| `app` | Next.js 15 production server (standalone build) |
| `postgres` | Postgres 16, one database per client |
| `minio` | S3-compatible object storage (files/uploads) |
| `worker` | Background job processor (pg-boss) — handles AI enrichment/email/call-pitch generation |
| `caddy` | Reverse proxy + automatic TLS |

This is a lightweight stack. It does **not** need a beefy server per client — it needs a *reliable, cheap, easy-to-standardize* small VPS, because you'll be provisioning one of these per client, repeatedly.

This changes the pricing question from "what's the biggest server we can afford" to "what's the best $/month building block, and how does cost scale as client count grows."

**Important:** you can also put multiple clients on one shared VPS while keeping each client's database fully separate (no code changes, no shared-schema risk) — see §7. That's a different thing from app-level multi-tenancy; it's the same isolation model you have today, just multiple databases co-located on one box instead of one VM per client.

---

## 2. Recommended sizing tiers

| Tier | vCPU | RAM | Disk | Fits |
|---|---|---|---|---|
| **Starter** | 2 | 4 GB | 40–80 GB SSD | Most clients. Low-to-moderate lead volume, a handful of concurrent admin users, worker off or lightly used. |
| **Standard** | 4 | 8 GB | 80–160 GB SSD | Larger clients, worker active with real AI enrichment jobs running regularly, more concurrent users, larger file/CSV uploads via MinIO. |
| **Heavy** | 4–8 | 16 GB | 160–320 GB SSD | Rare — only if a client pushes high lead volume + heavy background enrichment + large document storage all at once. |

**Recommendation: default every new client to the Starter tier (2 vCPU / 4 GB).** Postgres, MinIO, Next.js, Caddy, and the worker together idle comfortably under 1.5–2 GB RAM; 4 GB gives real headroom for traffic spikes and background enrichment jobs. Upgrade individual clients to Standard only if they show sustained load (slow dashboard, worker backlog, Postgres memory pressure).

Do not over-provision by default — at N clients, the gap between Starter and Standard pricing multiplied across your whole client base is real money (see §4).

---

## 3. Provider comparison

Prices below are shared-vCPU (non-dedicated) tiers, current as of August 2026. **Verify exact current pricing at checkout** — providers adjust pricing periodically (Hetzner in particular raised prices in mid-2026) and these are the best available figures at time of writing.

### Starter tier (2 vCPU / 4 GB / 40–80 GB)

| Provider | Plan | Specs | Price/mo | Notes |
|---|---|---|---|---|
| **Hetzner Cloud** ⭐ | CX22 / CX23 | 2 vCPU, 4 GB, 40 GB SSD | **~€4.50–4.99** (~$5) | Best raw $/spec. EU/US data centers. 20 TB traffic included. |
| **DigitalOcean** | Basic Droplet | 2 vCPU, 4 GB, 80 GB SSD (approx.) | **~$24** | Premium brand, excellent docs, very easy to standardize/automate. |
| **Vultr** | Cloud Compute | 2 vCPU, 4 GB, 80 GB SSD | **~$20–24** | Widest region selection; per-second billing. |
| **Contabo** | Cloud VPS 10 | 4 vCPU, 8 GB, ~150 GB SSD | **~$6–7** | Cheapest at this spec (actually beats Starter, closer to Standard specs). Known for oversold CPU/noisy neighbors — fine for this workload, but not for latency-sensitive clients. |
| **Linode (Akamai)** | Shared 4GB | 2 vCPU, 4 GB, 80 GB SSD | **~$24** | Similar tier to DO; solid reliability, Akamai-backed network. |
| **Namecheap** | Pulsar (unmanaged) | 2 vCPU, 2 GB, 40 GB SSD, 1 TB bandwidth | **~$6.88** | Close to Hetzner on price but half the RAM at this tier. Single data center (Phoenix, AZ) — no EU presence. Unmanaged; cPanel available as a paid add-on (~$17.88/mo) if you want a GUI. |

### Standard tier (4 vCPU / 8 GB / 80–160 GB)

| Provider | Plan | Specs | Price/mo |
|---|---|---|---|
| **Hetzner Cloud** ⭐ | CX32 / CX33 | 4 vCPU, 8 GB, 80 GB SSD | **~€7.70–9** (~$9) |
| **DigitalOcean** | Basic Droplet | 4 vCPU, 8 GB, 160 GB SSD | **~$48** |
| **Vultr** | Cloud Compute | 4 vCPU, 8 GB, 160 GB SSD | **~$40–48** |
| **Contabo** | Cloud VPS 20 | 6 vCPU, 16 GB, ~200 GB SSD | **~$13–16** |
| **Linode (Akamai)** | Shared 8GB | 4 vCPU, 8 GB, 160 GB SSD | **~$48** |
| **Namecheap** | Quasar (unmanaged) | 4 vCPU, 4 GB, 120 GB SSD, 3 TB bandwidth | **~$11.88** |

**Bottom line: Hetzner is roughly 4–5x cheaper than DigitalOcean/Vultr/Linode for equivalent specs**, and roughly on par with (or better organized than) Contabo, without Contabo's reputation for oversold CPU. Namecheap is competitively priced but consistently RAM-light for the price versus Hetzner, and only has one data center location. For a business provisioning one VPS per client at scale, this difference compounds fast.

---

## 4. Fleet economics — cost as client count grows

Assuming every client runs on a Starter-tier box:

| # of clients | Hetzner (~$5/mo ea.) | DigitalOcean/Vultr (~$24/mo ea.) | Contabo (~$6.50/mo ea.) |
|---|---|---|---|
| 5 | $25/mo | $120/mo | $32.50/mo |
| 20 | $100/mo | $480/mo | $130/mo |
| 50 | $250/mo | $1,200/mo | $325/mo |
| 100 | $500/mo | $2,400/mo | $650/mo |

At meaningful scale (50–100+ clients), the provider choice alone is a **$700–$1,900/month swing**. This is the single biggest lever in your infra cost — bigger than choosing between Starter and Standard tiers for any individual client.

---

## 5. Recommendation

1. **Default to Hetzner Cloud, CX22/CX23 tier (2 vCPU / 4 GB / 40 GB), for every new client.** Best $/spec by a wide margin, mature platform, EU + US East/West regions, generous included bandwidth (20 TB), simple API for scripting provisioning.
2. **Keep DigitalOcean as a secondary/fallback option** for clients who specifically require US-only compliance-sensitive hosting, or if a client's procurement team wants a more "enterprise-recognizable" vendor name on paper. DO's automation/API/Terraform ecosystem is also more mature if you want to build a self-serve provisioning pipeline later.
3. **Avoid Contabo for client-facing production** despite the low price — CPU is commonly oversold on their cloud VPS line, which risks inconsistent dashboard/API latency for clients. Fine for internal/staging/demo boxes only.
4. **Standardize the provisioning process now** (per [NEW-CLIENT-SETUP.md](NEW-CLIENT-SETUP.md)) so that whichever provider is chosen, spinning up a new client is: create VM → point DNS → `docker compose up -d --build` → seed. Worth scripting this (e.g. via Hetzner's API/CLI + a small shell script or Terraform) once you're past ~10 clients, so onboarding isn't manual VPS clicking every time.
5. **Revisit at ~30–50 clients**: at that scale it may be worth evaluating a small Kubernetes cluster or a managed-Postgres approach to reduce per-client operational overhead (patching, backups, monitoring) — but that's a real architecture change away from the current "one VPS per client" model, not a pricing decision, so don't do it prematurely.

---

## 6. Other recurring costs to budget for (not included in table above)

- **Backups**: most providers charge ~20% of instance price/month for automated snapshots. Budget for this — Postgres data loss for a client is not recoverable otherwise.
- **Domain + DNS**: usually negligible (~$10–15/year per client domain), but multiply by client count.
- **Object storage egress**: MinIO is self-hosted on-box here, so no separate S3 bill — but large file-heavy clients will eat into the VPS's included bandwidth faster.
- **Monitoring/alerting**: something like UptimeRobot (free tier) or Better Stack is worth adding per client so downtime is caught proactively, not reported by the client.

---

## 7. Alternative: one shared VPS, separate database per client

This is a standard pattern for agencies/vendors selling the same self-hosted app to many clients (not specific to this project) — sometimes called "single-tenant apps, multi-tenant hardware." Instead of one VPS per client, **one larger VPS hosts multiple clients**, but each client still gets their **own separate database and own app process/container** on that box. Nothing is shared between clients except the physical machine.

### How it works

- One VPS runs Postgres once, but with N separate databases inside it — one per client (real `CREATE DATABASE` per client, not a shared schema).
- Each client gets their own app container (own env vars, own domain, own branding, own login) pointed at only its own database. The application code itself doesn't need to be multi-tenant-aware at all — it's still one client per app instance, just many app instances sharing one box.
- A reverse proxy (Caddy, Nginx, Traefik) on the shared box fronts multiple domains/subdomains, one per client, routing each to the right app container.
- Onboarding a new client becomes: create a new database + start a new app container + add a DNS record — instead of provisioning a whole new VM.
- This is the middle ground between "fully isolated" (separate VM per client) and "fully multi-tenant" (one shared database/schema, clients as rows) — you get most of the cost savings of the former without the code complexity and cross-client-leak risk of the latter.

### Sizing for shared hosting

Postgres and Next.js scale with concurrent load and data volume, not client *count* directly — 20 lightly-active clients cost far less in resources than 20 heavily-active ones. As a rough planning baseline for this app's data model (~19 tables, standard CRM read/write patterns, no heavy analytics):

| Tier | vCPU | RAM | Disk | Rough client capacity |
|---|---|---|---|---|
| **Shared — Small** | 4 | 8 GB | 160 GB SSD | ~15–25 light/medium clients |
| **Shared — Medium** | 8 | 16 GB | 320 GB SSD | ~30–60 light/medium clients |
| **Shared — Large** | 16 | 32 GB | 480–640 GB SSD | ~60–120 light/medium clients |

These are planning estimates, not guarantees — actual headroom depends on how active each client's users are, worker/enrichment job volume, and file storage size in MinIO. Treat these as a starting point and watch Postgres CPU/memory and disk growth as real clients come on, then scale the VPS up (or split off a second shared VPS) before you hit a wall.

### Pricing (single VPS, shared across many clients)

| Provider | Plan | Specs | Price/mo |
|---|---|---|---|
| **Hetzner Cloud** ⭐ | CX32/CX33 (Shared–Small) | 4 vCPU, 8 GB, 80–160 GB | ~€8–9 (~$9) |
| **Hetzner Cloud** ⭐ | CX42/CX43 (Shared–Medium) | 8 vCPU, 16 GB, 160–320 GB | ~€18–20 (~$20) |
| **Hetzner Cloud** ⭐ | CX52/CX53 (Shared–Large) | 16 vCPU, 32 GB, 320–480 GB | ~€36–40 (~$40) |
| **DigitalOcean** | Basic/General Purpose | 8 vCPU, 16 GB, 320 GB | ~$96 |
| **DigitalOcean** | General Purpose | 16 vCPU, 32 GB, 640 GB | ~$192 |
| **Contabo** | Cloud VPS 20/30 | 6–8 vCPU, 16–24 GB, 200–400 GB | ~$13–25 |

**On Hetzner, a single Medium shared VPS (~$20/month) could plausibly hold 30–60 clients** — compare that to $150–300/month for the same client count on the per-client model (§4). That's the appeal: shared hosting is dramatically cheaper per client at scale.

### Trade-offs vs. one VPS per client

| | One VPS per client (§1–6) | Shared VPS, separate DB per client (this section) |
|---|---|---|
| **Cost per client at scale** | ~$5–9/mo each, linear | A fraction of that once the box is filled — much cheaper |
| **Blast radius of downtime** | One client affected | If the VPS itself goes down (hardware fault, network outage), **every client on that box goes down together**. If just one client's `app` container crashes, only that client is affected. |
| **Noisy-neighbor risk** | None — each client has dedicated resources | One client's heavy usage (large CSV import, enrichment burst) can slow down other clients sharing the box's CPU/RAM/disk I/O, even though databases are separate |
| **Data isolation** | Physical — separate VM, separate Postgres, separate disk | Same as today at the **database** level (separate DB per client, no schema-sharing risk) — but the underlying disk/CPU/RAM is shared hardware |
| **Ops overhead** | N servers to patch, monitor, back up | 1 server's OS/Docker/Postgres engine to patch — but still N databases and N `app` containers to manage inside it |
| **Backup/restore blast radius** | Restoring one client's backup only touches that client | Still per-client — restoring client A's database doesn't touch client B's, since they're separate databases. Only a full-box disaster (disk failure) risks everyone at once. |
| **Client-facing story** | Can honestly say "your own dedicated server" | Can still say "your own dedicated database" — just not "your own dedicated server." Fine for most clients; may not satisfy strict compliance/security requirements. |

### Recommendation if you go this route

- **This is a low-risk way to cut costs** compared to true app-level multi-tenancy (one shared database/schema across clients) — because each client keeps a fully separate database, there's no cross-client query risk and no application code changes needed. The only thing that changes is *where* Postgres physically runs.
- **Group clients onto shared boxes by size/activity**, not just by count — a shared VPS filled with 20 low-traffic clients behaves very differently than one with 20 heavy clients running frequent enrichment jobs.
- **A hybrid is the realistic default**: smaller/newer clients go on shared boxes, and any client with heavy load or a compliance requirement gets pulled onto their own dedicated VPS. Nothing stops you from moving a client from shared to dedicated later — it's just a database dump/restore + DNS change, not a rebuild.
- **Set a client-count ceiling per shared box before filling it** (e.g. "this box takes at most 15–20 clients"), watch actual CPU/RAM/disk I/O as it fills, and spin up the next shared VPS before the current one is under real pressure.
- **Still back up every client's database individually** (e.g. nightly `pg_dump` per database, not just one whole-box snapshot) so a single client's restore stays a single-client operation.

---

*Sources consulted: Hetzner Cloud pricing pages, DigitalOcean pricing pages, Vultr pricing pages, Contabo pricing pages, and third-party VPS pricing trackers (vpsfor.dev, costgoat.com, bestusavps.com, onedollarvps.com) as of August 2026. Exact prices fluctuate — confirm current rates directly with the provider before committing to a plan at scale.*
