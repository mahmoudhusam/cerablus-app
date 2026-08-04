/**
 * The menu as the public front-end consumes it.
 *
 * Deliberately the SAME shape the old static site's `window.MENU` had — a flat
 * `items` array carrying its category id in `cat`, plus a `categories` list for
 * ordering and headings. The customer-facing search / filter / cart logic was
 * built and tested against that shape, so keeping it means the port is a port
 * and not a rewrite. `lib/menu-data.ts` maps Prisma rows into it; nothing else
 * in the app should know what the database columns are called.
 *
 * Pure types only — no Prisma, no server imports — so client components can
 * import from here freely.
 */

/** A priced size/portion, e.g. "لشخص" / "لشخصين". */
export type MenuVariant = {
  label: string;
  price: number; // whole ل.س
};

export type MenuItem = {
  id: string;
  /** Category slug — matches a `MenuCategory.id`. */
  cat: string;
  name: string;
  desc: string;
  /** Single-price items only. `null` when the item has variants. */
  price: number | null;
  /** Empty array for a single-price item; never both this and `price`. */
  variants: MenuVariant[];
  /** Cloudinary URL, or "" → the branded placeholder tile. */
  image: string;
  available: boolean;
  featured: boolean;
  offer: boolean;
  /** Struck through beside the live price; only meaningful when `offer`. */
  oldPrice: number | null;
};

export type MenuCategory = {
  /** The category's slug — items reference it through `MenuItem.cat`. */
  id: string;
  name: string;
};

export type Menu = {
  currency: string; // "ل.س"
  categories: MenuCategory[]; // in sortOrder
  items: MenuItem[]; // category order, then sortOrder within the category
};
