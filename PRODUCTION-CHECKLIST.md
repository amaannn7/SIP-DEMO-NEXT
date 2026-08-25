# Production Readiness Checklist

Deployment mechanics (provisioning a VPS, `docker compose up`, seeding a
client) are already covered in [NEW-CLIENT-SETUP.md](NEW-CLIENT-SETUP.md) and
server sizing/pricing in [VPS-HOSTING-GUIDE.md](VPS-HOSTING-GUIDE.md). This
doc is the "does the *app* actually work correctly once it's up" checklist —
things that are silently fine in local dev but need a decision or a real
value before going live for a client.

## Object storage (file attachments, call recordings)

Local dev on this machine currently runs with **no S3/MinIO configured** —
`src/lib/storage/s3.ts` auto-detects this (`S3_ENDPOINT` unset) and falls
back to writing files to `.data/local-storage/` on disk instead, serving them
back through `/api/local-storage/[...key]`. This keeps local dev working
without Docker, but **it is not meant for production**:

- [ ] **Set real S3 credentials in `.env` before deploying.** Once
      `S3_ENDPOINT` is set, the app automatically switches to the real
      S3-compatible backend (`s3-backend.ts`) — no code change needed, just
      the env vars: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`,
      `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- [ ] **Decide the production storage backend**: the docker-compose stack
      ships a self-hosted MinIO container by default (see
      NEW-CLIENT-SETUP.md step 3) — fine for most clients. For a client with
      heavy file volume or a compliance requirement, point `S3_ENDPOINT` at
      real AWS S3, Cloudflare R2, or Backblaze B2 instead (all speak the same
      S3 API, same env vars, zero code changes).
  - If staying on self-hosted MinIO: its data lives in the `minio_data`
    Docker volume — **must be included in the server's backup routine**
    (VPS-HOSTING-GUIDE.md §6 already flags backups generally; MinIO's volume
    specifically needs the same treatment as the Postgres volume, or a lost
    disk means every client's uploaded files are gone with no recovery).
  - The local-filesystem fallback (`.data/local-storage/`) has **no backup
    story at all** and is explicitly a dev-only convenience — do not deploy
    with `S3_ENDPOINT` unset.

## Environment variables — generate fresh, never reuse across deployments

Per NEW-CLIENT-SETUP.md, every one of these must be a **fresh, unique value
per client deployment**, not copied from another client or from this dev
`.env`:

- [ ] `POSTGRES_PASSWORD`
- [ ] `SESSION_SECRET` (`openssl rand -hex 32`)
- [ ] `API_KEY_ENCRYPTION_KEY` (`openssl rand -hex 32`) — encrypts stored LLM
      provider keys at rest; losing/rotating this without a migration plan
      makes existing encrypted keys unreadable
- [ ] `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`
- [ ] `INITIAL_ADMIN_PASSWORD` — must be changed on first login, not left as
      the seed value

## Chat feature specifically

The chat rebuild this session added real-time messaging, markdown,
threading, and link previews. A few things only matter once it's exposed to
real users on a real network, not in a single-tab local test:

- [ ] **`chat-ws` process must actually be reachable at the URL the browser
      is told to use.** `NEXT_PUBLIC_CHAT_WS_URL` is baked into the client
      bundle at build time — confirm it's set to
      `wss://<client-domain>/chat-ws` (not `ws://localhost:4001/chat-ws`,
      the dev default) before building the production image. Caddyfile
      already proxies `/chat-ws` to the `chat-ws` service, so this is purely
      an env var correctness check, not a code change.
- [ ] **Verify the WS reconnect path under a real network** (not just
      localhost) — kill/restart the `chat-ws` container and confirm the
      sidebar's "Live / Reconnecting…" indicator recovers and the 3-second
      polling fallback (`message-pane.tsx`) actually keeps messages flowing
      while it's down.
- [ ] **Link previews make outbound HTTP requests to whatever URL a user
      pastes into chat.** SSRF protections are already in place
      (`lib/chat/link-preview.ts` blocks localhost/private-IP/cloud-metadata
      targets) — no action needed, just noting this is a live outbound
      network dependency to be aware of if the VPS has restrictive egress
      firewall rules.
- [ ] **Load-test attachment size under the real `bodySizeLimit`.** Raised to
      6MB in `next.config.ts` to match the composer's 5MB cap — if that cap
      is ever raised in the UI, this config must be raised to match, or
      uploads will crash with the same "Body exceeded limit" error this
      session hit.

## General pre-launch smoke test

Beyond NEW-CLIENT-SETUP.md §7's smoke test (create a lead, confirm dashboard,
trigger enrichment):

- [ ] Send a chat message with a file attachment end-to-end and confirm it's
      retrievable after a page reload (this exact flow was broken locally
      earlier in this session — confirm the fix holds once real S3/MinIO is
      configured, not just the local-filesystem fallback).
- [ ] Confirm `docker compose logs worker` shows no errors — the background
      job processor (AI research/email/call-pitch generation) running
      silently broken is easy to miss since nothing in the UI surfaces it
      immediately.
- [ ] Confirm HTTPS/TLS actually issued correctly (Caddy auto-provisions via
      Let's Encrypt — requires the DNS A record to already point at the VPS
      *before* first boot, per NEW-CLIENT-SETUP.md §2).
- [ ] Rotate/remove any setup-convenience credentials once the client is
      live (NEW-CLIENT-SETUP.md §8).
