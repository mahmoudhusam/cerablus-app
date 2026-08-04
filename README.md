# Cerablus Coffee — web app

Next.js (App Router) + TypeScript + Prisma + Neon Postgres.

- **Public site** — Arabic/RTL menu, cart, WhatsApp ordering. Prices in ل.س.
- **Admin** (`/admin`) — single-owner login to manage the menu and item photos.

See [CLAUDE.md](./CLAUDE.md) for the full spec and the step-by-step build order.
**Current status: Step 2 complete** (scaffold + schema + Neon wiring + menu seeded).
The database now holds the real menu and is the source of truth. No menu UI, admin,
auth, or uploads yet.

## Layout

| Path                  | What it is                                                        |
| --------------------- | ----------------------------------------------------------------- |
| `app/`                | Next.js App Router routes                                          |
| `lib/prisma.ts`       | the one shared Prisma client — always import from here             |
| `lib/generated/`      | generated Prisma client (gitignored, rebuilt by `prisma generate`) |
| `prisma/schema.prisma`| database schema                                                    |
| `prisma/migrations/`  | migration history                                                  |
| `prisma/seed.ts`      | one-time menu migration from `reference/menu.js`                   |
| `reference/menu.js`   | **seed input only** — the 133-item source menu                     |
| `styles/styles.css`   | **reference only** — approved design C tokens, wired up in Step 3  |

Neither reference file is imported by the app itself: `menu.js` is read only by the
seed script, and `styles.css` gets wired up in Step 3.

## Setup

```bash
npm install          # also runs `prisma generate`
cp .env.example .env.local
```

Then fill in `.env.local`. Only the two database URLs are needed right now; the
rest are placeholders for later steps.

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
