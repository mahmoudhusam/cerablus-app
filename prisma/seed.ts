/**
 * Cerablus Coffee — one-time menu migration (Step 2).
 *
 * Reads the client's real menu from `reference/menu.js` — the generated file
 * copied over from the old static site — and writes it into Postgres, which
 * becomes the source of truth from here on. Nothing is retyped: every value
 * comes straight out of that file.
 *
 * Strategy: WIPE AND RESEED, inside a single transaction.
 *   The menu has exactly one owner and one authoritative source, so there is
 *   no merge to do. Deleting the three tables and re-inserting is simpler than
 *   upserting and is trivially idempotent — re-running gives byte-identical
 *   content and identical counts, never duplicates. The transaction means a
 *   failure half-way rolls back to the previous menu rather than leaving the
 *   café with a partial one.
 *
 *   Caveat for later: rows get fresh cuids on every run, so once the owner has
 *   uploaded photos (Step 6) or edited items through the admin, re-running this
 *   seed WILL discard that work. It is a migration, not a maintenance tool.
 *
 * Run with:  npm run seed        (or `npx prisma db seed`)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

import { PrismaClient } from "../lib/generated/prisma/client";

// The seed may be started directly by npm, which does not load Next.js env
// files. Same order as prisma.config.ts: `.env.local` wins, because dotenv
// never overwrites a variable that is already set.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

// ---------------------------------------------------------------------------
// Source file
// ---------------------------------------------------------------------------

/** Shape of `window.MENU` in reference/menu.js. */
type SourceVariant = {
  label: string;
  price: number;
};

type SourceItem = {
  id: string;
  cat: string;
  name: string;
  desc?: string;
  price?: number | null;
  variants?: SourceVariant[];
  image?: string;
  available?: boolean;
  featured?: boolean;
  offer?: boolean;
  oldPrice?: number | null;
};

type SourceCategory = {
  id: string;
  name: string;
};

type SourceMenu = {
  currency: string;
  categories: SourceCategory[];
  items: SourceItem[];
};

const MENU_PATH = resolve(process.cwd(), "reference/menu.js");

/**
 * `reference/menu.js` is a browser script: it assigns to `window.MENU` and
 * exports nothing, so it cannot simply be imported. Rather than polluting this
 * process's globals, evaluate it in a throwaway `vm` context whose only global
 * is an empty `window`, then read the object back out. The file is our own
 * committed reference data, not user input.
 */
function loadSourceMenu(): SourceMenu {
  const source = readFileSync(MENU_PATH, "utf8");
  const sandbox: { window: { MENU?: SourceMenu } } = { window: {} };

  createContext(sandbox);
  runInContext(source, sandbox, { filename: MENU_PATH });

  const menu = sandbox.window.MENU;
  if (!menu?.categories?.length || !menu?.items?.length) {
    throw new Error(`No window.MENU found in ${MENU_PATH}`);
  }
  return menu;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/** An item's variants, or [] when it is a single-price item. */
function variantsOf(item: SourceItem): SourceVariant[] {
  return Array.isArray(item.variants) ? item.variants : [];
}

/**
 * Resolve the price/variants invariant: an item has EITHER a price OR
 * variants, never both. The source is expected to be clean; if it ever is not,
 * variants win (they carry more information) and we say so loudly.
 */
function resolvePrice(item: SourceItem, hasVariants: boolean): number | null {
  const price = item.price ?? null;

  if (hasVariants && price !== null) {
    console.warn(
      `  ! "${item.name}" (${item.id}) has both price ${price} and variants — keeping the variants, dropping the price.`,
    );
    return null;
  }
  if (!hasVariants && price === null) {
    throw new Error(`Item "${item.name}" (${item.id}) has neither a price nor variants.`);
  }
  return hasVariants ? null : price;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function createPrisma(): { prisma: PrismaClient; pool: Pool } {
  // Prefer the DIRECT (unpooled) Neon URL: this is a one-shot admin script
  // holding a single long transaction, which wants a real session rather than
  // the transaction-mode pooler the serverless app uses.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DIRECT_URL / DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Neon connection strings.",
    );
  }

  const pool = new Pool({ connectionString, max: 1 });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

async function main() {
  const menu = loadSourceMenu();
  const { prisma, pool } = createPrisma();

  console.log(`Source: ${MENU_PATH}`);
  console.log(
    `  ${menu.categories.length} categories, ${menu.items.length} items, currency ${menu.currency}\n`,
  );

  // Group items by their source category id, preserving source order. That
  // order becomes each item's sortOrder within its category.
  const itemsByCategory = new Map<string, SourceItem[]>();
  for (const item of menu.items) {
    const bucket = itemsByCategory.get(item.cat);
    if (bucket) {
      bucket.push(item);
    } else {
      itemsByCategory.set(item.cat, [item]);
    }
  }

  const knownCategories = new Set(menu.categories.map((category) => category.id));
  for (const cat of itemsByCategory.keys()) {
    if (!knownCategories.has(cat)) {
      throw new Error(`Item references unknown category "${cat}".`);
    }
  }

  let categoryCount = 0;
  let itemCount = 0;
  let variantCount = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        // Wipe first — see the strategy note at the top of this file. Deleted
        // child-first so this holds even if the cascade rules ever change.
        const deletedVariants = await tx.variant.deleteMany();
        const deletedItems = await tx.item.deleteMany();
        const deletedCategories = await tx.category.deleteMany();
        console.log(
          `Cleared: ${deletedCategories.count} categories, ${deletedItems.count} items, ${deletedVariants.count} variants\n`,
        );

        // Re-insert. One nested create per category writes the category, its
        // items and their variants together, so ordering and links cannot drift.
        for (const [index, category] of menu.categories.entries()) {
          const sourceItems = itemsByCategory.get(category.id) ?? [];

          const created = await tx.category.create({
            data: {
              name: category.name,
              // The source ids are already url-safe and stable — reuse them
              // as slugs rather than re-deriving them.
              slug: category.id,
              sortOrder: index, // first-appearance order in the source
              items: {
                create: sourceItems.map((item, itemIndex) => {
                  const variants = variantsOf(item);
                  return {
                    name: item.name,
                    desc: item.desc ?? "",
                    price: resolvePrice(item, variants.length > 0),
                    imageUrl: item.image ?? "",
                    available: item.available ?? true,
                    featured: item.featured ?? false,
                    offer: item.offer ?? false,
                    oldPrice: item.oldPrice ?? null,
                    sortOrder: itemIndex, // order within the category
                    variants: {
                      create: variants.map((variant, variantIndex) => ({
                        label: variant.label,
                        price: variant.price,
                        sortOrder: variantIndex,
                      })),
                    },
                  };
                }),
              },
            },
            select: { _count: { select: { items: true } } },
          });

          const variantsHere = sourceItems.reduce(
            (total, item) => total + variantsOf(item).length,
            0,
          );

          categoryCount += 1;
          itemCount += created._count.items;
          variantCount += variantsHere;

          console.log(
            `  [${String(index).padStart(2, "0")}] ${category.name} — ${created._count.items} items, ${variantsHere} variants`,
          );
        }
      },
      // Neon is remote and this writes ~250 rows; the 5s default is too tight.
      { timeout: 60_000, maxWait: 15_000 },
    );

    console.log(
      `\nSeeded: ${categoryCount} categories, ${itemCount} items, ${variantCount} variants.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\nSeed failed — the database was rolled back, nothing was changed.");
  console.error(error);
  process.exit(1);
});
