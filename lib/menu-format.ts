/**
 * Presentation helpers shared by the cards, the cart drawer and the WhatsApp
 * message. Ported from the old static site's app.js — same behaviour, same
 * wording, now typed.
 *
 * Pure functions with no browser or server dependencies, so both the server
 * components and the client tree import from here. That is what makes "one
 * currency-formatting path" true rather than aspirational.
 */
import type { MenuItem, MenuVariant } from "@/lib/menu-types";

/* --------------------------------------------------------------------------
   Arabic-aware text normalization
   --------------------------------------------------------------------------
   Real customers type without diacritics and spell alef/ya/ta-marbuta however
   they please ("قهوه" for "قهوة"). Both the query and the searched text run
   through the same normalizer, so those spellings all collapse to one form.
   -------------------------------------------------------------------------- */

// Harakat, the dagger alef and tatweel. Escapes, not literals: these are
// invisible or bidi-reordering characters that no editor renders reliably.
const TASHKEEL_AND_TATWEEL = /[\u064B-\u065F\u0670\u0640]/g;

/** Fold an Arabic/Latin string down to a spelling-insensitive search key. */
export function normalize(text: string | null | undefined): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(TASHKEEL_AND_TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** The text a search query is matched against. */
export function searchKeyFor(item: MenuItem): string {
  return normalize(`${item.name} ${item.desc}`);
}

/* --------------------------------------------------------------------------
   Money
   -------------------------------------------------------------------------- */

/* Group digits for display: 1500 -> "1,500". Western digits with a comma
   separator — the rest of the site already renders Western numerals (prices,
   the cart count, the quantity steppers), and Western digits stay unambiguous
   in the WhatsApp order the café reads on their phone. Built once and reused,
   so formatting 133+ prices per render stays cheap. */
const PRICE_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/**
 * THE currency-formatting path. Cards, the cart, the drawer total and the
 * WhatsApp message all come through here, so they can never disagree about a
 * number or about where the ل.س sits.
 */
export function formatPrice(value: number, currency: string): string {
  const shown = Number.isFinite(value) ? PRICE_FORMAT.format(value) : String(value);
  return `${shown} ${currency}`;
}

/* --------------------------------------------------------------------------
   Item shape
   -------------------------------------------------------------------------- */

/** An item's variants, or null when it is a single-price item. */
export function variantsOf(item: MenuItem): MenuVariant[] | null {
  return item.variants.length > 0 ? item.variants : null;
}

/**
 * Items the landing hero can use as slides: featured, available, and carrying a
 * real image. Computed on the server so the landing page ships four slide
 * records to the client instead of the whole menu.
 */
export function heroEligibleItems(items: MenuItem[]): MenuItem[] {
  return items.filter((item) => item.featured && item.available && item.image.trim() !== "");
}

/* --------------------------------------------------------------------------
   Filtering
   -------------------------------------------------------------------------- */

/* Chips that filter on an item flag instead of a category id, mapped to the
   flag they test. Their results span categories, which is also what decides
   whether category headings are worth showing. */
export const FLAG_CHIPS = {
  featured: "featured",
  offers: "offer",
} as const satisfies Record<string, keyof MenuItem>;

export type FlagChip = keyof typeof FLAG_CHIPS;

/** True for chips whose results are drawn from more than one category. */
export function isFlagChip(cat: string): cat is FlagChip {
  return Object.prototype.hasOwnProperty.call(FLAG_CHIPS, cat);
}

/* --------------------------------------------------------------------------
   Badges and prices
   -------------------------------------------------------------------------- */

export type Badge = { className: string; text: string };

/**
 * The one badge a card gets, in strict priority order:
 *
 *   1. غير متوفر — the most actionable fact; nothing else matters if you
 *      cannot order it.
 *   2. عرض       — an offer the customer can act on right now.
 *   3. مميّز      — nice to know, and the one worth losing.
 *
 * Kept as a single ordered decision rather than stacked conditions, so the
 * precedence is legible in one place and cannot drift.
 */
export function badgeFor(item: MenuItem): Badge | null {
  if (!item.available) return { className: "tag-out", text: "غير متوفر" };
  if (item.offer) return { className: "tag-offer", text: "عرض" };
  if (item.featured) return { className: "fav", text: "مميّز" };
  return null;
}

/**
 * The old price to strike through beside the live one, or null for "render
 * nothing extra". An "old" price at or below what you pay today is not a
 * discount, so it is dropped rather than shown.
 */
export function oldPriceFor(item: MenuItem, livePrice: number | null): number | null {
  if (!item.offer) return null;
  if (item.oldPrice === null || livePrice === null) return null;
  if (!Number.isFinite(item.oldPrice) || !Number.isFinite(livePrice)) return null;
  return item.oldPrice > livePrice ? item.oldPrice : null;
}
