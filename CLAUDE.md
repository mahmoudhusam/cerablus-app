# CLAUDE.md — Cerablus Coffee (Full App)

Context for Claude Code. **Read this before any change.** This project supersedes the
earlier static build. The rules here are the OPPOSITE of that project's — a backend,
build step, and framework are now REQUIRED, not forbidden.

---

## What this is

The production web app for **Cerablus Coffee**, a specialty café. Two faces, one app:

1. **Public site** — customers browse the menu (~133 items, 16 categories), add to a
   cart, and send the order to the café over **WhatsApp**. No accounts, no checkout,
   no online payment. This is the design the client already approved ("العصري" /
   direction C).
2. **Admin dashboard** (`/admin`, login-protected) — the café owner manages the menu:
   add / edit / delete items and categories, set prices, toggle availability /
   featured / offer, and **upload a photo per item**. This is the new capability that
   moved the project from a static site to a full app.

Currency is **Syrian pounds (ل.س)**. Language is **Arabic, RTL**, with occasional Latin
accent text.

---

## Why the architecture changed

The previous version was a static site whose menu came from a Google Sheet — because a
static site can't accept image uploads. The client now needs a real admin with photo
uploads, which requires a backend: a database for menu data and image hosting for
photos. That's this app. The Google Sheet + CSV parser from the old project are
**retired** — the admin writes clean data straight to the database, so all that
defensive CSV parsing is gone.

---

## Tech stack (required)

- **Next.js (App Router)** on **Vercel**. TypeScript.
- **Database: Neon (serverless Postgres)**, connected via Vercel's Neon integration.
- **ORM: Prisma.**
- **Image hosting: Cloudinary** — the admin uploads a photo, Cloudinary stores/serves/
  resizes it, and the returned URL is saved on the item. No filenames typed by anyone.
- **Auth: NextAuth (Auth.js)** — a SINGLE owner login for the admin. No multi-user, no
  roles, no public sign-up. It's one café owner.
- **Styling:** the existing `styles.css` / design tokens from the approved design C.
  Reuse them; do not redesign.

Do not add other frameworks, state libraries, or UI kits unless a step explicitly calls
for one.

---

## Build order (work ONE step at a time — do not work ahead)

- [x] **Step 1** — Scaffold Next.js + TypeScript + Prisma; define the schema; connect Neon.
- [x] **Step 2** — Seed script: migrate the 133 items from `/reference/menu.js` into the database.
- [x] **Step 3** — Public menu + landing: port design C to read from the DB. Reuse the
      cart, search, offers, and WhatsApp order flow from the old project.
- [x] **Step 4** — Admin auth: single-owner login (NextAuth), protect `/admin`.
- [ ] **Step 5** — Admin CRUD: manage items and categories.
- [ ] **Step 6** — Cloudinary image upload per item.
- [ ] **Step 7** — Caching / revalidation, deploy to Vercel, custom domain.

`/reference/menu.js` (133 items, ل.س) and `/styles/styles.css` were copied from the old
static repo as REFERENCE/SOURCE material: `menu.js` is the seed source for Step 2;
`styles.css` holds the approved design tokens. Neither is the app's runtime data source
— the database is. (They sat at the repo root until Step 1 moved them.)

---

## Data model (Prisma)

Model what the old `window.MENU` already described. Shape to implement in Step 1:

```prisma
model Category {
  id        String  @id @default(cuid())
  name      String              // Arabic display name, e.g. "القهوة الساخنة"
  slug      String  @unique      // stable url-safe id
  sortOrder Int                  // preserves menu ordering (first-appearance order)
  items     Item[]
}

model Item {
  id         String    @id @default(cuid())
  name       String                 // Arabic
  desc       String    @default("")
  price      Int?                    // single-price items (whole ل.س); null if variants
  imageUrl   String    @default("") // Cloudinary URL; "" -> placeholder
  available  Boolean   @default(true)
  featured   Boolean   @default(false)
  offer      Boolean   @default(false)
  oldPrice   Int?                    // struck-through; only meaningful when offer = true
  sortOrder  Int       @default(0)
  category   Category  @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  categoryId String
  variants   Variant[]
}

model Variant {
  id       String @id @default(cuid())
  label    String            // e.g. "صغير" / "كبير" / "شخص"
  price    Int               // whole ل.س
  sortOrder Int   @default(0)
  item     Item   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  itemId   String
}
```

Rules:
- An item has **either** a `price` **or** `variants`, never both (enforce in app logic).
- Prices are integers in whole ل.س. Syrian pound values are large (e.g. 60, 100, 1500);
  format for display with thousands separators, through a SINGLE formatting helper.
- `imageUrl` empty → the public card shows the branded placeholder. Never a broken image.
- `available: false` → "غير متوفر", dimmed, not addable.
- `featured` powers the الأكثر طلبًا filter and the hero slideshow.
- `offer` powers the العروض filter; `oldPrice` renders struck-through.

---

## Public site behavior (reuse from the old project)

The customer-facing logic is already designed and tested in the old static repo — port
it, don't reinvent it:
- Category filtering, live Arabic-normalized search (strip tashkeel; unify أإآ→ا, ى→ي,
  ة→ه), الأكثر طلبًا + العروض flag chips.
- Cart: in-memory, line key = itemId + variant label; qty steppers; running total.
- **WhatsApp order** is still the whole point — the order button builds a pre-filled
  wa.me message (items, line totals, grand total, then الاسم:/العنوان: prompts) in ل.س.
  Phone number in ONE server-side env/config value.
- Offer/badge precedence: غير متوفر > عرض > مميّز (exactly one badge).

**Performance:** the public site must NOT hit the database on every visit. Read the menu
at build/request time and cache it (Next.js caching / ISR / revalidate). When the admin
changes data, revalidate the affected pages so edits appear without a redeploy. Neon
scale-to-zero cold starts must never be in a customer's path — only the admin's.

---

## Admin behavior

- All of `/admin` is behind the single-owner login. No public access to any admin route
  or admin API. Protect both the pages AND the API/route handlers (never trust the UI).
- CRUD for categories (name, order) and items (all fields above), plus per-item image
  upload to Cloudinary.
- Uploads: validate type and size server-side; store only the resulting Cloudinary URL
  on the item. Never accept an arbitrary URL from the client as the image.
- After a successful edit, trigger revalidation of the public menu.

---

## Security (this app takes writes now — treat it seriously)

- Secrets (DATABASE_URL, NEXTAUTH_SECRET, Cloudinary keys, WhatsApp number) live ONLY in
  environment variables. Never commit them; never expose server secrets to the client
  bundle. Provide a `.env.example` with placeholder keys.
- Every admin API/route handler independently checks the session — do not rely on
  client-side guarding or on the page-level check alone.
- Validate and sanitize all input server-side (a strong schema validator). Never build
  SQL by hand — go through Prisma.
- Image upload: enforce allowed mime types and a max size on the server; reject the rest.
- Rate-limit the login route. Use a strong, unique NEXTAUTH_SECRET. Do not log secrets.

---

## Conventions

- TypeScript throughout; type the Prisma models end to end.
- **Never** apply `letter-spacing` or `text-transform: uppercase` to Arabic (breaks
  joining). Latin-only text is fine.
- Keep the design tokens from `styles.css` in one place; logical properties only
  (inset-inline, margin-inline) — no physical left/right — so RTL holds.
- Respect `prefers-reduced-motion`.
- One currency-formatting path; one price-display path. Cards, cart, and the WhatsApp
  message must never disagree about a number or the ل.س symbol.
- Commit per step; keep steps reviewable. Clear, English code comments.

---

## Do NOT

- Do NOT re-enter the menu by hand — it flows from `/reference/menu.js` via the Step 2 seed.
- Do NOT change the approved design C look, the brand colors, or the logo.
- Do NOT add user accounts, roles, public sign-up, online payment, or a mobile app.
- Do NOT put menu content in the repo as the source of truth — the database is the
  source of truth once seeded; `/reference/menu.js` is only the seed input.
- Do NOT let the public site depend on a live DB hit per request (cache it).
- Do NOT expose any admin route or secret to the public.
- Do NOT work ahead of the current step.
