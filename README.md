# Cerablus Coffee — web app

Next.js (App Router) + TypeScript + Prisma + Neon Postgres.

- **Public site** — Arabic/RTL menu, cart, WhatsApp ordering. Prices in ل.س.
- **Admin** (`/admin`) — single-owner login to manage the menu and item photos.

See [CLAUDE.md](./CLAUDE.md) for the full spec and the step-by-step build order.
**Current status: Step 3 complete** — the public site is live off the database:
a landing page at `/` and the full menu at `/menu`, with search, filters, a cart
and WhatsApp ordering. No admin, auth, or image uploads yet (Steps 4–6).

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

### The WhatsApp number

Set `CERABLUS_WHATSAPP_PHONE` to the café's number in international format, digits
only (e.g. `963xxxxxxxxx`). It is read on the server in `lib/site.ts` and passed into
the client tree as a prop — deliberately not a `NEXT_PUBLIC_*` variable.

**Until it is set, every wa.me link uses the placeholder `970590000000`** carried over
from the old build, and `npm run dev` warns about it on each render.

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
