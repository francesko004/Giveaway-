# QR Giveaway Platform

A production-ready, **free-entry** giveaway platform: people scan a QR code, register in under a minute on their phone, and the winner is chosen by a **publicly verifiable** commit-and-reveal draw using the [drand](https://drand.love) randomness beacon.

- Public site in **Albanian (default) and English**: landing page, server-synchronised countdown, registration, legal pages, data-request form, public draw verification.
- **Admin dashboard** (`/admin`): campaigns, QR codes & source analytics, participants (search, filters, CSV/Excel export, review), draw console, tamper-evident audit log, privacy requests, users & roles, settings.
- **Fairness engine**: frozen entry snapshot → SHA-256 commitment → pre-committed future drand round → BLS signature verification against the pinned League of Entropy key → deterministic, unbiased winner selection → anyone can re-verify (in the browser, via CLI, or by hand).

> No ticket purchases, paid entries or gambling features exist or should be added.

---

## Contents

1. [Stack](#stack)
2. [Quick start (development)](#quick-start-development)
3. [Environment variables](#environment-variables)
4. [Database](#database)
5. [Creating an administrator](#creating-an-administrator)
6. [Running a campaign](#running-a-campaign)
7. [QR codes](#qr-codes)
8. [How the draw works & how to verify it](#how-the-draw-works--how-to-verify-it)
9. [Security](#security)
10. [Deployment (Ubuntu VPS + Docker + Cloudflare)](#deployment-ubuntu-vps--docker--cloudflare)
11. [Backups & restore](#backups--restore)
12. [Testing](#testing)
13. [Legal & privacy — review before launch](#legal--privacy--review-before-launch)
14. [Project structure](#project-structure)

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, route handlers, `proxy.ts`), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui-style components on Radix UI, Lucide icons, Recharts, Sonner |
| Forms | React Hook Form + Zod (the same schema validates on client and server) |
| Data | PostgreSQL 16, Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Auth | Argon2id password hashing, opaque server-side sessions in HttpOnly cookies, role-based access |
| Fairness | drand quicknet, `@noble/curves` (BLS12-381), `@noble/hashes` (SHA-256) |
| Other | `qrcode`, `sharp` (image re-encoding), `exceljs`, Resend (optional e-mail), Cloudflare Turnstile (optional) |
| Tests | Vitest (unit + integration against PostgreSQL), Playwright (E2E) |
| Ops | Docker multi-stage build, Docker Compose, Caddy or Nginx, GitHub Actions CI |

## Quick start (development)

Requirements: Node.js ≥ 22, PostgreSQL 16 (local or `docker compose up -d db`).

```bash
npm install
cp .env.example .env              # set DATABASE_URL, APP_URL=http://localhost:3000, SESSION_SECRET
npx prisma migrate deploy         # creates tables + integrity triggers
SEED_DEMO=1 npm run db:seed       # settings + a demo campaign with 4 QR sources
npm run admin:create -- --email admin@example.com --name "Admin"
npm run dev
```

Open <http://localhost:3000/giveaway> (public) and <http://localhost:3000/admin> (admin).

## Environment variables

See [`.env.example`](.env.example) for the full annotated list. All variables are validated at runtime (`src/lib/env.ts`); the app refuses to start with an invalid configuration or the example `SESSION_SECRET` in production.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✓ | PostgreSQL connection string |
| `APP_URL` | ✓ | Public base URL — used in QR codes, e-mails, cookies (`__Host-` + `Secure` when https) |
| `SESSION_SECRET` | ✓ | ≥ 32 random chars (`openssl rand -base64 48`); keys form tokens and IP hashing |
| `TRUST_PROXY` | behind a proxy | Read client IP from `CF-Connecting-IP` / `X-Forwarded-For` |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Transactional e-mail. Without them, e-mails are skipped and everything else works |
| `ADMIN_NOTIFICATION_EMAIL` | optional | Receives "registrations closed" / "draw completed" notices |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | optional | Cloudflare Turnstile on the registration form |
| `CRON_SECRET`, `DISABLE_SCHEDULER` | optional | External scheduler instead of the built-in 30 s tick |
| `DRAW_COMMIT_LEAD_SECONDS` | optional | Gap between commitment and committed round (default 120, min 60) |
| `DRAND_URLS` | optional | Override drand relays |
| `UPLOAD_DIR` | optional | Where uploaded images are stored (outside the web root) |

Secrets are only read on the server; nothing except `NEXT_PUBLIC_TURNSTILE_SITE_KEY` reaches the browser.

## Database

- Schema: [`prisma/schema.prisma`](prisma/schema.prisma) — `User`, `Session`, `Campaign`, `QRSource`, `Participant`, `ConsentRecord`, `Draw`, `DrawResult`, `AuditLog`, `PageVisit`, `RateLimit`, `SiteSettings`, `DataRequest`.
- Migrations: `prisma/migrations/`. Apply with `npm run db:deploy` (production) or `npm run db:migrate` (development).
- [`20261123171400_integrity_guards`](prisma/migrations/20261123171400_integrity_guards/migration.sql) adds PostgreSQL triggers that make the fairness records tamper-resistant **even against direct SQL**:
  - `Draw`: commitment fields immutable; randomness/signature/winner writable exactly once; only `COMMITTED → COMPLETED/INVALIDATED` and `COMPLETED → INVALIDATED`; the committed round must be after the commitment time; no deletes.
  - `DrawResult`, `AuditLog`: append-only (no updates except publicly-recorded disqualification/notification, no deletes).
  - `Participant`: no inserts, re-classification or reference changes once the campaign's entry list is frozen; no deletes once a campaign has draw history (erasure = anonymisation).
  - `Campaign`: draw parameters frozen while locked; unlocking only after the draw is publicly invalidated; no deletes.
- Duplicate prevention is enforced by unique constraints `(campaignId, emailCanonical)` and `(campaignId, phone)` in addition to application checks, so concurrent submissions cannot slip through.

## Creating an administrator

```bash
npm run admin:create -- --email you@company.al --name "Your Name" --role SUPER_ADMIN
# Docker:
docker compose run --rm -it migrate npm run admin:create -- --email you@company.al --name "Your Name"
```

The password is prompted (or read from `ADMIN_PASSWORD`) — never passed as an argument. Running it again for an existing e-mail resets the password and signs out all sessions.

Roles: **SUPER_ADMIN** (users, settings, privacy requests, exceptional audited overrides, draw invalidation) · **ADMIN** (campaigns, QR codes, participants, exports, draws) · **VIEWER** (read-only).

## Running a campaign

1. **Admin → Campaigns → New campaign.** Content (Albanian + optional English), prize image (re-encoded to WebP, metadata stripped), schedule (in the configured timezone, default `Europe/Tirane`), winners & alternates, field rules (city hidden/optional/required, minimum age, allowed phone countries), public participant count.
2. **Publish.** The status becomes *Scheduled* or *Active* depending on the start time. *Pause*, *Resume*, *Close now* and *Unpublish* are available from the campaign header; every action is audited.
3. **Settings → Featured campaign** decides what `/giveaway` shows (otherwise the active campaign is chosen automatically). Each campaign also has its own URL `/giveaway/{slug}`.
4. Registration closes automatically at the end time (enforced server-side, independent of the browser countdown). Admins receive a notification if e-mail is configured.
5. **Review flagged entries** (automatic flags: disposable e-mail domains, many entries from the same network). Marking an entry invalid requires a reason and is audited.
6. **Draw console → Freeze entries & publish commitment.** Then the draw is revealed automatically once the committed drand round is produced (or click *Retrieve randomness*).
7. Notify the winner from the draw console. If a winner is ineligible or unreachable, **Disqualify** (public reason) — the next pre-ordered alternate takes the place.

Campaign parameters that affect the draw (dates, winner/alternate counts, eligibility, field rules) are **protected after registration closes**. Changing them is an exceptional SUPER_ADMIN operation that needs a public reason and invalidates any existing commitment (the original proof is kept and shown publicly).

## QR codes

- Admin → campaign → **QR codes**: create one code per location / poster / partner / channel.
- Each code prints a **stable URL** `https://your-domain/q/{code}`. The server redirects to the destination path (editable at any time, same-origin only) adding `?src={sourceId}&utm_medium=qr` — so the printed code never needs to change.
- Download **PNG** (up to 4096 px) or **SVG**, or open a print-ready A4 poster.
- **Disable** a code without deleting history; scans of disabled codes land on `/giveaway` without attribution.
- Attribution is resolved server-side only within the campaign being entered — a `src` value can never move an entry to another campaign or grant anything.
- Analytics per source: scans, unique visitors (cookieless, daily-rotating salted hash — no raw IPs, no cookies), registrations, conversion. Visit analytics can be switched off in Settings.

## How the draw works & how to verify it

Algorithm version `gv-sha256-drand-rs/1` (source: [`src/lib/fairness`](src/lib/fairness)). Everything below is reproducible by anyone from public data.

1. **Close registrations** — enforced by the server and by a database trigger once the list is frozen.
2. **Commit** — for every eligible entry
   `entryHash = SHA256("giveaway-entry/v1\n" + campaignId + "\n" + referenceNumber)`
   (only the public reference number — no personal data). The canonical snapshot is
   ```
   giveaway-snapshot/v1
   campaign:<campaignId>
   count:<n>
   <entryHash_0>      ← sorted ascending, one per line, LF, trailing newline
   …
   ```
   and the commitment is `SHA256(snapshot)`. Stored and published together with the entry count, algorithm version, and the drand chain hash/public key.
3. **Select randomness** — the server fixes the first drand *quicknet* round produced after `max(now + lead, drawAt)`. The round is published with the commitment and is **guaranteed to be in the future** (DB-enforced). If the beacon is unreachable, the **same** round is retried; there is no way to request another round or supply randomness manually. The beacon is accepted only if its BLS signature verifies against the **pinned** network public key and `randomness == SHA256(signature)`.
4. **Winner calculation** — for pick `k = 0,1,…` and counter `c = 0,1,…`:
   `x = SHA256("giveaway-draw/v1\n" + campaignId + "\n" + snapshotHash + "\n" + randomness + "\n" + k + "\n" + c)` as a 256-bit integer.
   With `m` entries remaining, accept if `x < 2²⁵⁶ − (2²⁵⁶ mod m)` (rejection sampling — no modulo bias), else increment `c`. Index `x mod m` into the remaining sorted list; remove it; continue. The first `winnerCount` picks are winners, the rest are alternates in order.
5. **Public verification** — `/verify/{campaignId}` shows campaign, commitment timestamp, entry count, snapshot hash, drand network + round + randomness + signature, winning references, algorithm version and verification status — never names, e-mails or phones.

Ways to verify independently:

- **In the browser**: "Verify it yourself" on the verification page downloads the snapshot, fetches the round **directly from drand** and recomputes everything locally. Participants can also check their own reference is in the frozen list (hashed locally; the reference is never sent).
- **CLI**: `npm run draw:verify -- https://your-domain <campaignId>`
- **By hand**: `GET /api/verify/{campaignId}/proof` (JSON) and `GET /api/verify/{campaignId}/snapshot` (text, `sha256sum` must equal the commitment); check the beacon at `https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/{round}`. An independent Python re-implementation of steps 2 and 4 produces identical test vectors (see `tests/unit/fairness.test.ts`).

Invalidation: a SUPER_ADMIN can publicly invalidate a draw with a reason (e.g. staff entries included by mistake). The original proof stays visible and verifiable, the entry list is unfrozen for correction, and the next draw is linked to it (`supersedes`) and must commit to a new future round.

## Security

- **Authentication**: Argon2id (19 MiB, t=2), constant-time handling of unknown users, account lockout after 5 failures (15 min), IP rate limiting, opaque 256-bit session tokens stored only as SHA-256 hashes, HttpOnly + SameSite=Lax cookies (`__Host-` + Secure on HTTPS), sliding expiry, sessions revoked on password/role/deactivation changes.
- **Authorization**: every admin page checks the session server-side (`requireAdminPage`), every admin API is wrapped by `adminRoute(minRole, …)`; `proxy.ts` only does an optimistic redirect.
- **CSRF**: Origin/Referer must match the app on every state-changing request; JSON-only bodies; SameSite cookies.
- **Bot & abuse protection**: honeypot field, HMAC-signed time-stamped form token (blocks blind POSTs, replays and instant submissions), PostgreSQL-backed rate limits (burst + hourly per IP hash), optional Cloudflare Turnstile, automatic flagging (disposable domains, many entries per network), duplicate detection with e-mail canonicalisation (Gmail dots, `+tags`) and E.164 phone normalisation.
- **Injection/XSS**: Prisma parameterised queries only; React escaping; admin-edited legal text rendered by a safe Markdown subset (no raw HTML); strict nonce-based CSP with `strict-dynamic`, `frame-ancestors 'none'`, `object-src 'none'`; CSV/XLSX formula-injection protection.
- **Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP; `noindex` + `no-store` on admin.
- **Uploads**: size-limited, decoded and **re-encoded** by sharp (only JPEG/PNG/WebP/AVIF accepted; EXIF/GPS stripped), random file names, stored outside the web root, served with `nosniff` and a sandbox CSP.
- **Privacy by design**: no raw IPs stored (keyed HMAC only), cookieless analytics, query strings removed from referrers, no PII in logs, the public proof contains no personal data.
- **Errors**: internal errors are logged server-side and returned as generic messages.
- **Audit**: append-only, hash-chained audit log (each record hashes the previous one); the Audit page verifies the chain and shows where it breaks if someone tampers with the database directly.

## Deployment (Ubuntu VPS + Docker + Cloudflare)

```bash
# 1. Server prerequisites (Ubuntu 22.04/24.04)
sudo apt update && sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sh
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable

# 2. Code + configuration
sudo mkdir -p /opt/giveaway && sudo chown $USER /opt/giveaway
git clone <your-repo-url> /opt/giveaway && cd /opt/giveaway
cp .env.example .env && nano .env        # APP_URL, SESSION_SECRET, POSTGRES_PASSWORD, DOMAIN, …

# 3. Build and start (migrations run automatically in the one-shot "migrate" service)
docker compose --profile caddy up -d --build
docker compose run --rm migrate npm run db:seed
docker compose run --rm -it migrate npm run admin:create -- --email you@company.al --name "You"

# 4. Check
curl -s https://your-domain/api/health
```

- **Caddy** (included, `--profile caddy`) obtains TLS certificates automatically. With **Cloudflare** in front, use SSL mode *Full (strict)*, keep `TRUST_PROXY=true`, and restrict ports 80/443 to [Cloudflare IP ranges](https://www.cloudflare.com/ips/) so the origin cannot be reached directly. An **Nginx** example is in [`deploy/nginx.conf`](deploy/nginx.conf).
- The app container listens on `127.0.0.1:3000` only; PostgreSQL is not exposed.
- **Updates**: `git pull && docker compose --profile caddy up -d --build` (migrations are applied before the app starts).
- **Scheduler**: the app runs its housekeeping every 30 s (auto-close, reveal due draws, retention, cleanup). If you run several app replicas, set `DISABLE_SCHEDULER=1` and add a single cron job:
  `* * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/tick`
- **Health check**: `GET /api/health` (used by the Docker `HEALTHCHECK`).
- **Outbound access**: the server must reach `api.drand.sh`, `api2.drand.sh`, `api3.drand.sh`, `drand.cloudflare.com` (and `api.resend.com`, `challenges.cloudflare.com` if used). If outbound HTTPS must go through an egress proxy, set `NODE_USE_ENV_PROXY=1` with `HTTPS_PROXY`.

No URL is hard-coded: everything public is built from `APP_URL`.

## Backups & restore

```bash
./scripts/backup.sh                  # pg_dump (custom format) + uploads tarball + SHA256SUMS in ./backups
# cron (daily 03:17 UTC):  17 3 * * * cd /opt/giveaway && ./scripts/backup.sh >> backups/backup.log 2>&1
./scripts/restore.sh backups/db-<stamp>.dump backups/uploads-<stamp>.tar.gz
```

Strategy: daily dumps kept 30 days on the server (`KEEP_DAYS`), **copied off-site** (e.g. `rclone copy backups remote:giveaway-backups` to S3/B2 with versioning), and a periodic test restore into a scratch database. After a restore, open **Admin → Audit log** to confirm the hash chain is intact. Draw proofs remain independently verifiable from the published data even if the server is lost.

## Testing

```bash
npm run typecheck && npm run lint
npm test                                 # unit + integration (needs PostgreSQL; uses giveaway_test)
npm run build && npm run test:e2e        # Playwright, mobile viewport, isolated giveaway_e2e database
LIVE_DRAND=1 npx vitest run tests/integration/live-drand.test.ts   # optional: real draw on the live drand network
```

Coverage highlights:

| Area | Where |
|---|---|
| Registration validation, phone/e-mail normalisation | `tests/unit/validation.test.ts` |
| Duplicates (incl. concurrent), closed/paused/scheduled/draft, freeze trigger, honeypot, form token, rate limits, flagging, QR attribution & cross-campaign manipulation | `tests/integration/registration.test.ts` |
| Activation/closing boundaries, countdown boundaries, timezone/DST, CSV escaping | `tests/unit/time-status.test.ts` |
| Unauthorised/forbidden/CSRF admin access, login lockout, audited exports, QR redirect, no PII in proofs | `tests/integration/admin-api.test.ts` |
| SHA-256 commitment vectors, snapshot canonicality, one-ID tampering detection, real drand BLS vectors (quicknet + chained), rejection sampling, determinism, proof verification | `tests/unit/fairness.test.ts` |
| Full draw lifecycle, beacon retry of the same round, forged beacons, invalidation & linked re-draw, alternates, protected parameters, DB immutability, audit hash chain, retention | `tests/integration/draw.test.ts` |
| End-to-end mobile journey: QR scan → validation → registration → reference → duplicate → language switch → admin lookup with attribution → protected admin | `tests/e2e/registration.spec.ts` |

## Legal & privacy — review before launch

This software provides the technical building blocks, **not legal compliance**. Before launch, have qualified Albanian counsel review at least:

- **Personal data protection**: Albania's data protection law currently in force (the GDPR-aligned act that replaced Law No. 9887/2008 — confirm the exact law with counsel), and the **GDPR** if you target EU residents. Confirm legal bases, controller details, any registration/notification duties towards the Commissioner (IDP), processor agreements (hosting, Resend, Cloudflare) and international transfers.
- **Prize promotions**: whether your giveaway needs notification/approval or must follow specific rules (prize value, tax withholding on prizes, publication of results), and that it is clearly a free-entry promotion, not a game of chance.
- **Consumer protection & advertising** rules for the campaign texts.
- **Minors**: the minimum age setting and how age is verified when handing over the prize.
- **Retention period** (Settings → Privacy) and the **default Terms & Privacy templates** in `src/content/legal.ts` / Settings — they are starting points only.
- **Marketing consent** is separate, optional and unchecked by default; consent records store the policy version and timestamp. Confirm the wording and the opt-out process.
- **Cookieless analytics** use a daily-rotating salted hash of IP + user agent; confirm this is acceptable without consent in your setup, or disable analytics in Settings.

Implemented privacy features: consent records with policy versions, separate marketing consent, data-request workflow (access export as JSON, erasure via anonymisation that keeps draw proofs valid, marketing opt-out), configurable retention with automatic anonymisation, marketing-only export, minimal data collection.

## Project structure

```
src/
  app/
    (public)/giveaway, verify, terms, privacy   public pages (i18n)
    admin/                                       login + (panel) dashboard pages, print view
    api/                                         public + admin route handlers, health, cron
    q/[code]/                                    stable QR redirect
  components/  ui/ landing/ admin/ verify/ shared/
  lib/
    fairness/    isomorphic engine: snapshot, drand, selection, verification
    auth/ security/ validation/ email/ i18n/
    env.ts db.ts api.ts uploads.ts time.ts csv.ts
  services/      campaigns, participants, draws, qr, analytics, audit, settings, scheduler
  content/       legal templates
  proxy.ts       CSP nonce + optimistic admin redirect
  instrumentation.ts  built-in scheduler
prisma/          schema, migrations (incl. integrity triggers), seed
scripts/         create-admin, verify-draw CLI, backup/restore
tests/           unit, integration, e2e, fixtures (real drand beacons)
deploy/          Caddyfile, nginx example
```
