# Cerablus Coffee — web app

Next.js (App Router) + TypeScript + Prisma + Neon Postgres.

- **Public site** — Arabic/RTL menu, cart, WhatsApp ordering. Prices in ل.س.
- **Admin** (`/admin`) — single-owner login to manage the menu and item photos.

See [CLAUDE.md](./CLAUDE.md) for the full spec and the step-by-step build order.
**Current status: Step 4 complete** — the public site is live off the database
(`/` and `/menu`), and `/admin` is behind a single-owner login. The admin is a
locked shell only: no editing or image uploads yet (Steps 5–6).

## Layout

| Path                    | What it is                                                          |
| ----------------------- | ------------------------------------------------------------------- |
| `app/page.tsx`          | landing page (server component, prerendered)                        |
| `app/menu/page.tsx`     | menu page (server component, prerendered)                           |
| `components/menu/`      | the menu page's client tree — search, chips, cart, drawer           |
| `components/landing/`   | landing-only client bits — hero panel, preview row                  |
| `lib/menu-data.ts`      | **server only** — the cached Prisma read + `revalidateMenu()`        |
| `lib/menu-types.ts`     | the menu shape the front-end consumes                               |
| `lib/menu-format.ts`    | search normalizer, price formatting, badges (shared, pure)          |
| `lib/menu-order.ts`     | cart model + the WhatsApp order message (shared, pure)              |
| `lib/site.ts`           | **server only** — WhatsApp number, site URL                         |
| `proxy.ts`              | edge gate on `/admin/*` and `/api/admin/*` (layer 1)                 |
| `lib/auth.config.ts`    | edge-safe Auth.js config — session, cookies, the route gate          |
| `lib/auth.ts`           | Node-side Auth.js — the Credentials provider and bcrypt compare      |
| `lib/admin-auth.ts`     | `requireAdmin()` / `requireAdminApi()` (layer 3)                      |
| `lib/rate-limit.ts`     | in-memory login limiter                                             |
| `app/admin/login/`      | the only unauthenticated page under /admin                          |
| `app/admin/(dashboard)/`| protected shell; its layout is layer 2                              |
| `scripts/hash-password.ts` | one-off: prints the bcrypt hash for ADMIN_PASSWORD_HASH          |
| `lib/prisma.ts`         | the one shared Prisma client — always import from here              |
| `lib/generated/`        | generated Prisma client (gitignored, rebuilt by `prisma generate`)  |
| `styles/styles.css`     | the live stylesheet — approved design C tokens                      |
| `prisma/schema.prisma`  | database schema                                                     |
| `prisma/seed.ts`        | one-time menu migration from `reference/menu.js`                    |
| `reference/`            | **not built** — the old static site, kept as the port's source      |

`reference/` holds the previous static build (`index.html`, `menu.html`, `app.js`,
`styles.css`) plus `menu.js`. Nothing there ships: `menu.js` is read only by the seed
script, and the rest is the design and behaviour this app was ported from. The live
stylesheet is `styles/styles.css` — `reference/styles.css` is the untouched original.

### How the pages are put together

`/` and `/menu` are **server components**. They call `getMenu()`, which is the only
place that touches Postgres, and hand the result to a client tree as a prop. Prisma
never reaches the browser.

- **Caching.** `getMenu()` is wrapped in `unstable_cache` under the tag `"menu"` with
  a one-hour TTL, and both routes set `revalidate = 3600`, so they are prerendered
  and served from the Full Route Cache. A visitor never waits on a Neon cold start.
- **Invalidation.** `revalidateMenu()` in `lib/menu-data.ts` drops the tag and both
  page paths. Step 5's admin mutations call it after every successful write, which is
  what makes an edit show up without a redeploy.

## Setup

```bash
npm install          # also runs `prisma generate`
cp .env.example .env.local
```

Then fill in `.env.local`. The two database URLs and `CERABLUS_WHATSAPP_PHONE` are
what the public site needs; the rest are placeholders for later steps.

### Getting the Neon URLs

In the Neon console (or Vercel's Neon integration), open your project's connection
details. You need **both** forms of the connection string:

| Env var        | Which Neon string                            | Used by                            |
| -------------- | -------------------------------------------- | ---------------------------------- |
| `DATABASE_URL` | **Pooled** — host contains `-pooler`          | the running app (`lib/prisma.ts`)  |
| `DIRECT_URL`   | **Direct** — same host *without* `-pooler`    | `prisma migrate` only              |

Serverless functions must go through the pooler or they exhaust Neon's connection
limit. Migrations must *not* — they need a real session that a transaction-mode
pooler can't give them.

`.env` and `.env.local` are gitignored. Never commit a real connection string.

### First migration

The initial migration is already generated in `prisma/migrations/`. To create the
tables on Neon:

```bash
npx prisma migrate deploy
```

Then confirm the three tables (`Category`, `Item`, `Variant`) exist:

```bash
npx prisma studio
```

Use `npx prisma migrate dev --name <change>` for *subsequent* schema changes — it
generates a new migration and applies it.

### Seeding the menu

```bash
npm run seed         # or: npx prisma db seed
```

Reads `reference/menu.js` and writes 16 categories, 133 items and 95 variants into
Postgres. It **wipes the three tables and re-inserts**, all inside one transaction,
so it is safe to re-run and cannot leave a half-seeded database.

> This is a migration, not a maintenance tool. Rows get fresh ids on every run, so
> once the owner has uploaded photos or edited items through the admin (Steps 5–6),
> re-running the seed will discard that work.

### Admin login (Step 4)

One owner. There is no user table, no sign-up and no password reset — four
environment variables **are** the account.

```bash
openssl rand -base64 32     # -> NEXTAUTH_SECRET
npm run hash-password       # -> ADMIN_PASSWORD_HASH
```

Then set `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `NEXTAUTH_SECRET` and
`NEXTAUTH_URL` in `.env.local`.

> **Escape the `# Cerablus Coffee — web app

Next.js (App Router) + TypeScript + Prisma + Neon Postgres.

- **Public site** — Arabic/RTL menu, cart, WhatsApp ordering. Prices in ل.س.
- **Admin** (`/admin`) — single-owner login to manage the menu and item photos.

See [CLAUDE.md](./CLAUDE.md) for the full spec and the step-by-step build order.
**Current status: Step 4 complete** — the public site is live off the database
(`/` and `/menu`), and `/admin` is behind a single-owner login. The admin is a
locked shell only: no editing or image uploads yet (Steps 5–6).

## Layout

| Path                    | What it is                                                          |
| ----------------------- | ------------------------------------------------------------------- |
| `app/page.tsx`          | landing page (server component, prerendered)                        |
| `app/menu/page.tsx`     | menu page (server component, prerendered)                           |
| `components/menu/`      | the menu page's client tree — search, chips, cart, drawer           |
| `components/landing/`   | landing-only client bits — hero panel, preview row                  |
| `lib/menu-data.ts`      | **server only** — the cached Prisma read + `revalidateMenu()`        |
| `lib/menu-types.ts`     | the menu shape the front-end consumes                               |
| `lib/menu-format.ts`    | search normalizer, price formatting, badges (shared, pure)          |
| `lib/menu-order.ts`     | cart model + the WhatsApp order message (shared, pure)              |
| `lib/site.ts`           | **server only** — WhatsApp number, site URL                         |
| `proxy.ts`              | edge gate on `/admin/*` and `/api/admin/*` (layer 1)                 |
| `lib/auth.config.ts`    | edge-safe Auth.js config — session, cookies, the route gate          |
| `lib/auth.ts`           | Node-side Auth.js — the Credentials provider and bcrypt compare      |
| `lib/admin-auth.ts`     | `requireAdmin()` / `requireAdminApi()` (layer 3)                      |
| `lib/rate-limit.ts`     | in-memory login limiter                                             |
| `app/admin/login/`      | the only unauthenticated page under /admin                          |
| `app/admin/(dashboard)/`| protected shell; its layout is layer 2                              |
| `scripts/hash-password.ts` | one-off: prints the bcrypt hash for ADMIN_PASSWORD_HASH          |
| `lib/prisma.ts`         | the one shared Prisma client — always import from here              |
| `lib/generated/`        | generated Prisma client (gitignored, rebuilt by `prisma generate`)  |
| `styles/styles.css`     | the live stylesheet — approved design C tokens                      |
| `prisma/schema.prisma`  | database schema                                                     |
| `prisma/seed.ts`        | one-time menu migration from `reference/menu.js`                    |
| `reference/`            | **not built** — the old static site, kept as the port's source      |

`reference/` holds the previous static build (`index.html`, `menu.html`, `app.js`,
`styles.css`) plus `menu.js`. Nothing there ships: `menu.js` is read only by the seed
script, and the rest is the design and behaviour this app was ported from. The live
stylesheet is `styles/styles.css` — `reference/styles.css` is the untouched original.

### How the pages are put together

`/` and `/menu` are **server components**. They call `getMenu()`, which is the only
place that touches Postgres, and hand the result to a client tree as a prop. Prisma
never reaches the browser.

- **Caching.** `getMenu()` is wrapped in `unstable_cache` under the tag `"menu"` with
  a one-hour TTL, and both routes set `revalidate = 3600`, so they are prerendered
  and served from the Full Route Cache. A visitor never waits on a Neon cold start.
- **Invalidation.** `revalidateMenu()` in `lib/menu-data.ts` drops the tag and both
  page paths. Step 5's admin mutations call it after every successful write, which is
  what makes an edit show up without a redeploy.

## Setup

```bash
npm install          # also runs `prisma generate`
cp .env.example .env.local
```

Then fill in `.env.local`. The two database URLs and `CERABLUS_WHATSAPP_PHONE` are
what the public site needs; the rest are placeholders for later steps.

### Getting the Neon URLs

In the Neon console (or Vercel's Neon integration), open your project's connection
details. You need **both** forms of the connection string:

| Env var        | Which Neon string                            | Used by                            |
| -------------- | -------------------------------------------- | ---------------------------------- |
| `DATABASE_URL` | **Pooled** — host contains `-pooler`          | the running app (`lib/prisma.ts`)  |
| `DIRECT_URL`   | **Direct** — same host *without* `-pooler`    | `prisma migrate` only              |

Serverless functions must go through the pooler or they exhaust Neon's connection
limit. Migrations must *not* — they need a real session that a transaction-mode
pooler can't give them.

`.env` and `.env.local` are gitignored. Never commit a real connection string.

### First migration

The initial migration is already generated in `prisma/migrations/`. To create the
tables on Neon:

```bash
npx prisma migrate deploy
```

Then confirm the three tables (`Category`, `Item`, `Variant`) exist:

```bash
npx prisma studio
```

Use `npx prisma migrate dev --name <change>` for *subsequent* schema changes — it
generates a new migration and applies it.

### Seeding the menu

```bash
npm run seed         # or: npx prisma db seed
```

Reads `reference/menu.js` and writes 16 categories, 133 items and 95 variants into
Postgres. It **wipes the three tables and re-inserts**, all inside one transaction,
so it is safe to re-run and cannot leave a half-seeded database.

> This is a migration, not a maintenance tool. Rows get fresh ids on every run, so
> once the owner has uploaded photos or edited items through the admin (Steps 5–6),
> re-running the seed will discard that work.

 in the hash.** Next.js runs every `.env` value through
> dotenv-expand, which reads `# Cerablus Coffee — web app

Next.js (App Router) + TypeScript + Prisma + Neon Postgres.

- **Public site** — Arabic/RTL menu, cart, WhatsApp ordering. Prices in ل.س.
- **Admin** (`/admin`) — single-owner login to manage the menu and item photos.

See [CLAUDE.md](./CLAUDE.md) for the full spec and the step-by-step build order.
**Current status: Step 4 complete** — the public site is live off the database
(`/` and `/menu`), and `/admin` is behind a single-owner login. The admin is a
locked shell only: no editing or image uploads yet (Steps 5–6).

## Layout

| Path                    | What it is                                                          |
| ----------------------- | ------------------------------------------------------------------- |
| `app/page.tsx`          | landing page (server component, prerendered)                        |
| `app/menu/page.tsx`     | menu page (server component, prerendered)                           |
| `components/menu/`      | the menu page's client tree — search, chips, cart, drawer           |
| `components/landing/`   | landing-only client bits — hero panel, preview row                  |
| `lib/menu-data.ts`      | **server only** — the cached Prisma read + `revalidateMenu()`        |
| `lib/menu-types.ts`     | the menu shape the front-end consumes                               |
| `lib/menu-format.ts`    | search normalizer, price formatting, badges (shared, pure)          |
| `lib/menu-order.ts`     | cart model + the WhatsApp order message (shared, pure)              |
| `lib/site.ts`           | **server only** — WhatsApp number, site URL                         |
| `proxy.ts`              | edge gate on `/admin/*` and `/api/admin/*` (layer 1)                 |
| `lib/auth.config.ts`    | edge-safe Auth.js config — session, cookies, the route gate          |
| `lib/auth.ts`           | Node-side Auth.js — the Credentials provider and bcrypt compare      |
| `lib/admin-auth.ts`     | `requireAdmin()` / `requireAdminApi()` (layer 3)                      |
| `lib/rate-limit.ts`     | in-memory login limiter                                             |
| `app/admin/login/`      | the only unauthenticated page under /admin                          |
| `app/admin/(dashboard)/`| protected shell; its layout is layer 2                              |
| `scripts/hash-password.ts` | one-off: prints the bcrypt hash for ADMIN_PASSWORD_HASH          |
| `lib/prisma.ts`         | the one shared Prisma client — always import from here              |
| `lib/generated/`        | generated Prisma client (gitignored, rebuilt by `prisma generate`)  |
| `styles/styles.css`     | the live stylesheet — approved design C tokens                      |
| `prisma/schema.prisma`  | database schema                                                     |
| `prisma/seed.ts`        | one-time menu migration from `reference/menu.js`                    |
| `reference/`            | **not built** — the old static site, kept as the port's source      |

`reference/` holds the previous static build (`index.html`, `menu.html`, `app.js`,
`styles.css`) plus `menu.js`. Nothing there ships: `menu.js` is read only by the seed
script, and the rest is the design and behaviour this app was ported from. The live
stylesheet is `styles/styles.css` — `reference/styles.css` is the untouched original.

### How the pages are put together

`/` and `/menu` are **server components**. They call `getMenu()`, which is the only
place that touches Postgres, and hand the result to a client tree as a prop. Prisma
never reaches the browser.

- **Caching.** `getMenu()` is wrapped in `unstable_cache` under the tag `"menu"` with
  a one-hour TTL, and both routes set `revalidate = 3600`, so they are prerendered
  and served from the Full Route Cache. A visitor never waits on a Neon cold start.
- **Invalidation.** `revalidateMenu()` in `lib/menu-data.ts` drops the tag and both
  page paths. Step 5's admin mutations call it after every successful write, which is
  what makes an edit show up without a redeploy.

## Setup

```bash
npm install          # also runs `prisma generate`
cp .env.example .env.local
```

Then fill in `.env.local`. The two database URLs and `CERABLUS_WHATSAPP_PHONE` are
what the public site needs; the rest are placeholders for later steps.

### Getting the Neon URLs

In the Neon console (or Vercel's Neon integration), open your project's connection
details. You need **both** forms of the connection string:

| Env var        | Which Neon string                            | Used by                            |
| -------------- | -------------------------------------------- | ---------------------------------- |
| `DATABASE_URL` | **Pooled** — host contains `-pooler`          | the running app (`lib/prisma.ts`)  |
| `DIRECT_URL`   | **Direct** — same host *without* `-pooler`    | `prisma migrate` only              |

Serverless functions must go through the pooler or they exhaust Neon's connection
limit. Migrations must *not* — they need a real session that a transaction-mode
pooler can't give them.

`.env` and `.env.local` are gitignored. Never commit a real connection string.

### First migration

The initial migration is already generated in `prisma/migrations/`. To create the
tables on Neon:

```bash
npx prisma migrate deploy
```

Then confirm the three tables (`Category`, `Item`, `Variant`) exist:

```bash
npx prisma studio
```

Use `npx prisma migrate dev --name <change>` for *subsequent* schema changes — it
generates a new migration and applies it.

### Seeding the menu

```bash
npm run seed         # or: npx prisma db seed
```

Reads `reference/menu.js` and writes 16 categories, 133 items and 95 variants into
Postgres. It **wipes the three tables and re-inserts**, all inside one transaction,
so it is safe to re-run and cannot leave a half-seeded database.

> This is a migration, not a maintenance tool. Rows get fresh ids on every run, so
> once the owner has uploaded photos or edited items through the admin (Steps 5–6),
> re-running the seed will discard that work.

 as the start of a variable reference — and a
> bcrypt hash is `$2b$12$…`. Left alone it is silently truncated into a wrong
> string, and quoting does **not** help; only a backslash before each `# Cerablus Coffee — web app

Next.js (App Router) + TypeScript + Prisma + Neon Postgres.

- **Public site** — Arabic/RTL menu, cart, WhatsApp ordering. Prices in ل.س.
- **Admin** (`/admin`) — single-owner login to manage the menu and item photos.

See [CLAUDE.md](./CLAUDE.md) for the full spec and the step-by-step build order.
**Current status: Step 4 complete** — the public site is live off the database
(`/` and `/menu`), and `/admin` is behind a single-owner login. The admin is a
locked shell only: no editing or image uploads yet (Steps 5–6).

## Layout

| Path                    | What it is                                                          |
| ----------------------- | ------------------------------------------------------------------- |
| `app/page.tsx`          | landing page (server component, prerendered)                        |
| `app/menu/page.tsx`     | menu page (server component, prerendered)                           |
| `components/menu/`      | the menu page's client tree — search, chips, cart, drawer           |
| `components/landing/`   | landing-only client bits — hero panel, preview row                  |
| `lib/menu-data.ts`      | **server only** — the cached Prisma read + `revalidateMenu()`        |
| `lib/menu-types.ts`     | the menu shape the front-end consumes                               |
| `lib/menu-format.ts`    | search normalizer, price formatting, badges (shared, pure)          |
| `lib/menu-order.ts`     | cart model + the WhatsApp order message (shared, pure)              |
| `lib/site.ts`           | **server only** — WhatsApp number, site URL                         |
| `proxy.ts`              | edge gate on `/admin/*` and `/api/admin/*` (layer 1)                 |
| `lib/auth.config.ts`    | edge-safe Auth.js config — session, cookies, the route gate          |
| `lib/auth.ts`           | Node-side Auth.js — the Credentials provider and bcrypt compare      |
| `lib/admin-auth.ts`     | `requireAdmin()` / `requireAdminApi()` (layer 3)                      |
| `lib/rate-limit.ts`     | in-memory login limiter                                             |
| `app/admin/login/`      | the only unauthenticated page under /admin                          |
| `app/admin/(dashboard)/`| protected shell; its layout is layer 2                              |
| `scripts/hash-password.ts` | one-off: prints the bcrypt hash for ADMIN_PASSWORD_HASH          |
| `lib/prisma.ts`         | the one shared Prisma client — always import from here              |
| `lib/generated/`        | generated Prisma client (gitignored, rebuilt by `prisma generate`)  |
| `styles/styles.css`     | the live stylesheet — approved design C tokens                      |
| `prisma/schema.prisma`  | database schema                                                     |
| `prisma/seed.ts`        | one-time menu migration from `reference/menu.js`                    |
| `reference/`            | **not built** — the old static site, kept as the port's source      |

`reference/` holds the previous static build (`index.html`, `menu.html`, `app.js`,
`styles.css`) plus `menu.js`. Nothing there ships: `menu.js` is read only by the seed
script, and the rest is the design and behaviour this app was ported from. The live
stylesheet is `styles/styles.css` — `reference/styles.css` is the untouched original.

### How the pages are put together

`/` and `/menu` are **server components**. They call `getMenu()`, which is the only
place that touches Postgres, and hand the result to a client tree as a prop. Prisma
never reaches the browser.

- **Caching.** `getMenu()` is wrapped in `unstable_cache` under the tag `"menu"` with
  a one-hour TTL, and both routes set `revalidate = 3600`, so they are prerendered
  and served from the Full Route Cache. A visitor never waits on a Neon cold start.
- **Invalidation.** `revalidateMenu()` in `lib/menu-data.ts` drops the tag and both
  page paths. Step 5's admin mutations call it after every successful write, which is
  what makes an edit show up without a redeploy.

## Setup

```bash
npm install          # also runs `prisma generate`
cp .env.example .env.local
```

Then fill in `.env.local`. The two database URLs and `CERABLUS_WHATSAPP_PHONE` are
what the public site needs; the rest are placeholders for later steps.

### Getting the Neon URLs

In the Neon console (or Vercel's Neon integration), open your project's connection
details. You need **both** forms of the connection string:

| Env var        | Which Neon string                            | Used by                            |
| -------------- | -------------------------------------------- | ---------------------------------- |
| `DATABASE_URL` | **Pooled** — host contains `-pooler`          | the running app (`lib/prisma.ts`)  |
| `DIRECT_URL`   | **Direct** — same host *without* `-pooler`    | `prisma migrate` only              |

Serverless functions must go through the pooler or they exhaust Neon's connection
limit. Migrations must *not* — they need a real session that a transaction-mode
pooler can't give them.

`.env` and `.env.local` are gitignored. Never commit a real connection string.

### First migration

The initial migration is already generated in `prisma/migrations/`. To create the
tables on Neon:

```bash
npx prisma migrate deploy
```

Then confirm the three tables (`Category`, `Item`, `Variant`) exist:

```bash
npx prisma studio
```

Use `npx prisma migrate dev --name <change>` for *subsequent* schema changes — it
generates a new migration and applies it.

### Seeding the menu

```bash
npm run seed         # or: npx prisma db seed
```

Reads `reference/menu.js` and writes 16 categories, 133 items and 95 variants into
Postgres. It **wipes the three tables and re-inserts**, all inside one transaction,
so it is safe to re-run and cannot leave a half-seeded database.

> This is a migration, not a maintenance tool. Rows get fresh ids on every run, so
> once the owner has uploaded photos or edited items through the admin (Steps 5–6),
> re-running the seed will discard that work.

 does.
> `npm run hash-password` prints the escaped line for `.env.local` and the plain
> hash for Vercel's dashboard (which is not parsed by dotenv). If the hash is
> malformed the server logs a specific error instead of leaving you guessing at
> "بيانات الدخول غير صحيحة".

**Three layers guard `/admin`**, and each one holds if the others are removed:

1. `proxy.ts` — the edge gate, redirects before any page code runs.
2. `app/admin/(dashboard)/layout.tsx` — a server-side session check in the
   render path, which no routing mistake can skip.
3. `requireAdmin()` — called at the point of use. **Step 5 must call this first
   in every server action and route handler that mutates data.** A hidden button
   is not a guard.

The login is rate-limited to 5 attempts per 10 minutes per client address
(in-memory, per instance — see `lib/rate-limit.ts` for what that does and does
not buy). Failures are always the same generic message, and an unknown username
costs the same time as a wrong password, so neither can be probed.

### The WhatsApp number

The café's number is **963939426710** (displayed as +963 939 426 710).

Set `CERABLUS_WHATSAPP_PHONE=963939426710` — digits only, no `+`, no spaces. It is
read on the server in `lib/site.ts` and passed into the client tree as a prop —
deliberately not a `NEXT_PUBLIC_*` variable. The human-readable form shown in the
footer is formatted from that same value by `formatPhone()` in `lib/business.ts`, so
the number a customer reads and the number their phone dials cannot drift apart.

`lib/site.ts` falls back to the same number when the variable is unset, so a forgotten
env var degrades to "correct" rather than to a dead link — but set it anyway, in
`.env.local` **and** in Vercel (Production + Preview).

> **`/` and `/menu` are prerendered**, so the number is baked into their HTML at build
> time. Changing the env var only reaches the public pages on the next build, or once
> ISR regenerates them (any admin edit does this immediately via `revalidateMenu()`).

### Hours, address, tagline

All of the café's public details live in one pure module, `lib/business.ts` —
tagline, city, opening hours (`11:00–01:00`, which crosses midnight), address and the
Google Maps search link. Change them there and every page follows.

## Commands

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | dev server on http://localhost:3000             |
| `npm run build`      | `prisma generate` + production build            |
| `npm run lint`       | ESLint                                          |
| `npm run db:deploy`  | apply pending migrations (use in CI / on Neon)  |
| `npm run db:migrate` | create + apply a new migration (local dev)      |
| `npm run db:studio`  | browse the database                             |
| `npm run seed`       | wipe + reseed the menu from `reference/menu.js`  |
| `npm run hash-password` | print a bcrypt hash for ADMIN_PASSWORD_HASH  |
