/**
 * SERVER ONLY — the single place the public site reads the menu from Postgres.
 *
 * CACHING (CLAUDE.md: "the public site must NOT hit the database on every
 * visit"). Two layers, both keyed to one tag:
 *
 *   1. The Next.js Data Cache. `getMenu()` is wrapped in `unstable_cache` with
 *      the tag MENU_CACHE_TAG and a one-hour TTL, so the Prisma query runs at
 *      most once an hour per deployment no matter how many visitors arrive.
 *   2. The Full Route Cache. `/` and `/menu` set `export const revalidate`, so
 *      the rendered HTML is served from the edge and only regenerated on the
 *      same schedule.
 *
 * A Neon scale-to-zero cold start therefore lands on a background revalidation,
 * never in a customer's request path.
 *
 * INVALIDATION: call `revalidateMenu()`. Step 5's admin mutations call it after
 * every successful create / update / delete, which drops the cached query AND
 * the prerendered pages, so an edit shows up without a redeploy.
 */
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import type { Menu, MenuItem } from "@/lib/menu-types";
import { prisma } from "@/lib/prisma";

/** The one cache tag the public menu hangs off. */
export const MENU_CACHE_TAG = "menu";

/** Ceiling on how stale the menu can get if nothing calls revalidateMenu(). */
export const MENU_REVALIDATE_SECONDS = 3600; // one hour

/** The pages whose HTML is built from the menu. */
const MENU_PAGES = ["/", "/menu"] as const;

/**
 * Read the whole menu, ordered exactly as the café arranged it: categories by
 * sortOrder, items by sortOrder within their category, variants by sortOrder.
 *
 * One query with nested includes rather than three round trips — on a
 * serverless function talking to Neon, round trips are the cost that matters.
 */
async function queryMenu(): Promise<Menu> {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  // Flatten into the front-end's shape (see lib/menu-types.ts). Category order
  // drives item order, so `items` is already in menu order end to end.
  const items: MenuItem[] = categories.flatMap((category) =>
    category.items.map((item) => {
      const variants = item.variants.map((variant) => ({
        label: variant.label,
        price: variant.price,
      }));
      return {
        id: item.id,
        cat: category.slug,
        name: item.name,
        desc: item.desc,
        // Enforce the either/or invariant on the way out too: an item that
        // somehow carries both loses the single price, matching the seed's rule.
        price: variants.length > 0 ? null : item.price,
        variants,
        image: item.imageUrl,
        available: item.available,
        featured: item.featured,
        offer: item.offer,
        oldPrice: item.oldPrice,
      };
    }),
  );

  return {
    currency: "ل.س",
    categories: categories.map((category) => ({
      id: category.slug,
      name: category.name,
    })),
    items,
  };
}

const loadMenu = unstable_cache(queryMenu, ["cerablus-public-menu"], {
  tags: [MENU_CACHE_TAG],
  revalidate: MENU_REVALIDATE_SECONDS,
});

/** What the public pages render when the database cannot be reached at all. */
const EMPTY_MENU: Menu = { currency: "ل.س", categories: [], items: [] };

/**
 * The public menu, from cache. Server components only.
 *
 * MENU BUILD RESILIENCE
 * ---------------------
 * `next build` prerenders `/` and `/menu`, which means it runs this query. In a
 * build environment with no DATABASE_URL — or with the database asleep or
 * unreachable — that used to abort the whole build.
 *
 * The fix is deliberately narrow, and does NOT weaken the caching model:
 *
 *   - the try/catch sits OUTSIDE `unstable_cache`. A failed query rejects, and
 *     a rejected promise is never written to the Data Cache, so the empty menu
 *     is not cached and the very next call retries the database. The tag, the
 *     TTL and revalidateMenu() are all untouched.
 *   - a normal request against a working database never enters the catch and
 *     behaves exactly as before.
 *   - a build with no database still emits both pages, from an empty menu.
 *
 * The cost is one honest window: if the build itself could not reach the
 * database, the prerendered HTML is an empty menu, and the first visitor after
 * deploy sees that stale copy while ISR regenerates in the background — the
 * page is correct from the next request on. Deploys that do have DATABASE_URL
 * (the normal Vercel case) never hit this at all.
 */
export async function getMenu(): Promise<Menu> {
  try {
    return await loadMenu();
  } catch (error) {
    // The message only; a connection error can carry the URL — and therefore
    // the password — in its payload.
    console.error(
      "[cerablus] could not read the menu from the database; serving an empty menu.",
      error instanceof Error ? error.message : error,
    );
    return EMPTY_MENU;
  }
}

/**
 * Drop every cached copy of the menu — the query result and the prerendered
 * pages built from it.
 *
 * Step 5 calls this from its admin server actions / route handlers after a
 * successful write, which is what makes an edit appear on the public site
 * without a redeploy.
 *
 * `revalidateTag(tag, "max")` is Next 16's form — the second argument says how
 * stale a copy may still be served while the new one is built, and "max" is the
 * documented replacement for the old single-argument call. The explicit
 * `revalidatePath` calls then purge the two prerendered pages, so the fix does
 * not depend on how a given Next version tracks tag-to-route dependencies.
 *
 * (A Server Action that needs the admin's OWN next render to see the change
 * immediately can additionally call `updateTag(MENU_CACHE_TAG)`; that is a
 * Step 5 concern and Server-Action-only, so it is deliberately not done here.)
 */
export function revalidateMenu(): void {
  revalidateTag(MENU_CACHE_TAG, "max");
  for (const path of MENU_PAGES) revalidatePath(path);
}
