# VPS Hosting Plan

**Prepared for:** Levata HQ internal use
**Date:** August 19, 2026
**Scope:** Pricing for hosting 4 clients on one shared VPS now, with a simple upgrade path as client count grows. DigitalOcean is the primary recommendation; other providers included for comparison.

---

## Model

One VPS, split across clients. Each client runs a fully independent stack (own database, own app) on the same box — nothing shared between clients except the physical server. No separate server per client.

---

## DigitalOcean (recommended)

**Now — 4 clients: 4 vCPU / 8 GB RAM / 160 GB SSD**

| Billing | Price |
|---|---|
| Monthly | **$48.00/mo** |
| Monthly + backups (+20%) | **$57.60/mo** |
| Yearly (12 × monthly) | **$576.00/yr** |
| Yearly + backups | **$691.20/yr** |

DigitalOcean bills monthly/hourly only — no annual pre-pay discount. The yearly figures above are simply 12× the monthly rate for budgeting.

**Future upgrade path** — same droplet, resized in place when needed, no migration:

| # Clients | Specs | Monthly | + Backups | Yearly | Yearly + Backups |
|---|---|---|---|---|---|
| **4** (now) | 4 vCPU / 8 GB / 160 GB SSD | $48.00 | $57.60 | $576.00 | $691.20 |
| **8–10** | 8 vCPU / 16 GB / 320 GB SSD | $96.00 | $115.20 | $1,152.00 | $1,382.40 |
| **15–20** | 8 vCPU / 32 GB / 300 GB SSD | $225.00 | $270.00 | $2,700.00 | $3,240.00 |
| **25–30** | 16 vCPU / 64 GB / 500 GB SSD | $450.00 | $540.00 | $5,400.00 | $6,480.00 |

---

## Hetzner Cloud (cheapest alternative)

**Now — 4 clients: 8 vCPU / 16 GB RAM / 160 GB SSD**

| Billing | Price |
|---|---|
| Monthly | **$18.00** (€16.40) |
| Monthly + backups (+20%) | **$21.60** |
| Yearly | **$216.00** |
| Yearly + backups | **$259.20** |

**Future upgrade path:**

| # Clients | Specs | Monthly | + Backups | Yearly | Yearly + Backups |
|---|---|---|---|---|---|
| **4** (now) | 8 vCPU / 16 GB / 160 GB SSD | $18.00 | $21.60 | $216.00 | $259.20 |
| **8–10** | 16 vCPU / 32 GB / 320 GB SSD | $37.00 | $44.40 | $444.00 | $532.80 |
| **15–20** | 16 vCPU / 64 GB / 480 GB SSD (dedicated vCPU tier) | ~$90.00 | ~$108.00 | $1,080.00 | $1,296.00 |

Roughly 2.5–3x cheaper than DigitalOcean for the same specs. Trade-off: EU/US data centers only (smaller global footprint than DO), more self-serve support, less brand recognition if a client asks who's hosting them.

---

## Contabo (budget alternative)

**Now — 4 clients: 6 vCPU / 16 GB RAM / ~200 GB SSD**

| Billing | Price |
|---|---|
| Monthly | **$14.00** |
| Yearly | **$168.00** |

Cheapest option on paper. Not recommended as the primary choice — Contabo has a known reputation for oversold CPU on shared plans, which risks inconsistent performance for paying clients. Reasonable as a low-stakes fallback, not for client-facing production by default.

---

## Vultr / Linode (not recommended here)

Both land at or above DigitalOcean's price for an equivalent 8 vCPU / 16 GB tier (roughly $96–110/mo), so neither offers a cost advantage over DO or Hetzner at this scale — only worth considering if a client specifically needs one of their data center regions.

---

## Bottom line

- **DigitalOcean** — best if brand recognition, global regions, and polished tooling matter more than shaving costs.
- **Hetzner** — best value if margin matters more, and EU/US coverage is enough for your clients.
- Either way: **don't buy ahead** — start at the smallest tier that fits 4 clients comfortably, and resize up one tier at a time only as you approach real capacity.

---

*Pricing current as of August 2026, sourced from provider pricing pages and third-party VPS trackers. Providers adjust pricing periodically — confirm current rates before committing.*
