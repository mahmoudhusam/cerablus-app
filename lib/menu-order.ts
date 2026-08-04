/**
 * The cart model and the WhatsApp order message.
 *
 * Ported from the old static site's app.js. Everything here is pure — no React,
 * no DOM — so the same functions build the drawer's totals, the order link, and
 * (in a test or a script) the message text.
 *
 * The order flow ends in a pre-filled WhatsApp message; there is no checkout.
 * The message is built into the link's href rather than assembled in a click
 * handler, so it behaves identically for a mouse click, the keyboard, a
 * long-press "copy link", and a browser where JS has not upgraded the page yet.
 */
import { formatPrice } from "@/lib/menu-format";
import type { MenuItem, MenuVariant } from "@/lib/menu-types";

/**
 * One line of the cart.
 *
 * `price` is captured at add time from the variant or from `item.price` — both
 * of which are the LIVE price. `oldPrice` is display-only and must never reach
 * the cart.
 */
export type CartLine = {
  id: string;
  name: string;
  /** "" for a single-price item. */
  variantLabel: string;
  price: number;
  qty: number;
};

/**
 * The cart itself: a Map because insertion order is stable, which keeps drawer
 * lines from jumping around as quantities change.
 */
export type Cart = Map<string, CartLine>;

/** Line identity: a large and a small cappuccino are different lines. */
export function lineKey(id: string, variantLabel: string): string {
  return `${id}::${variantLabel}`;
}

/** Human label for a line, used in the drawer and by the reader status. */
export function lineTitle(line: CartLine): string {
  return line.variantLabel ? `${line.name} (${line.variantLabel})` : line.name;
}

/** Total quantity and money across the whole cart. */
export function cartTotals(cart: Cart): { count: number; total: number } {
  let count = 0;
  let total = 0;
  cart.forEach((line) => {
    count += line.qty;
    // Skip a malformed price rather than poisoning the whole total with NaN.
    const amount = line.price * line.qty;
    if (Number.isFinite(amount)) total += amount;
  });
  return { count, total };
}

/**
 * Add one of `item` to the cart, at `variant` if the item has sizes.
 *
 * Returns a NEW Map (React state must not be mutated in place) plus the line
 * that changed, so the caller can announce it to screen readers. Returns null
 * when the item cannot be added at all.
 */
export function addToCart(
  cart: Cart,
  item: MenuItem,
  variant: MenuVariant | null,
): { cart: Cart; line: CartLine } | null {
  if (!item.available) return null; // belt and braces; the button is disabled

  const variantLabel = variant ? variant.label : "";
  const price = Number(variant ? variant.price : item.price);
  if (!Number.isFinite(price)) return null; // a malformed row must not poison the cart

  const key = lineKey(item.id, variantLabel);
  const next: Cart = new Map(cart);
  const existing = next.get(key);

  const line: CartLine = existing
    ? { ...existing, qty: existing.qty + 1 }
    : { id: item.id, name: item.name, variantLabel, price, qty: 1 };

  next.set(key, line);
  return { cart: next, line };
}

/**
 * Move a line's quantity by delta; hitting zero removes the line outright.
 * Returns the new cart and what happened, for the live region.
 */
export function changeQty(
  cart: Cart,
  key: string,
  delta: number,
): { cart: Cart; line: CartLine; removed: boolean } | null {
  const existing = cart.get(key);
  if (!existing) return null;

  const next: Cart = new Map(cart);
  const qty = existing.qty + delta;

  if (qty <= 0) {
    next.delete(key);
    return { cart: next, line: existing, removed: true };
  }

  const line = { ...existing, qty };
  next.set(key, line);
  return { cart: next, line, removed: false };
}

/* --------------------------------------------------------------------------
   WhatsApp order message
   -------------------------------------------------------------------------- */

/* Beyond this many characters some mobile browsers and WhatsApp's own intent
   handler truncate the URL, which would send a half-order. Measured against the
   fully encoded href, since Arabic characters cost six characters each once
   percent-encoded. */
const MAX_ORDER_URL = 1800;

/** "كابتشينو (كبير)" for a variant line, plain name for a single-price one. */
function orderLineName(line: CartLine): string {
  return line.variantLabel ? `${line.name} (${line.variantLabel})` : line.name;
}

/**
 * Build the order message.
 *
 * Two knobs, both only used by the oversized-order fallback below:
 *   compact — drop the per-line amounts, keeping item, variant and quantity.
 *   limit   — list at most this many lines, then say how many were left out.
 *
 * The grand total is always the true total for the whole cart, at every level
 * of degradation, so the café always knows what the order comes to.
 *
 * All money goes through formatPrice(), so this message can never disagree with
 * the drawer about a number.
 */
export function buildOrderMessage(
  cart: Cart,
  currency: string,
  { compact = false, limit = Infinity }: { compact?: boolean; limit?: number } = {},
): string {
  const lines: string[] = [];
  let listed = 0;

  cart.forEach((line) => {
    if (listed >= limit) return;
    listed += 1;

    const amount = line.price * line.qty;
    // A malformed price must never reach the café as "NaN ل.س" — drop the
    // amount and keep the item, so the order is still actionable.
    const showAmount = !compact && Number.isFinite(amount);
    lines.push(
      showAmount
        ? `• ${orderLineName(line)} ×${line.qty} — ${formatPrice(amount, currency)}`
        : `• ${orderLineName(line)} ×${line.qty}`,
    );
  });

  // Never drop items silently: say plainly that the list was shortened.
  const omitted = cart.size - listed;
  if (omitted > 0) lines.push(`• و${omitted} صنف إضافي — التفاصيل بالمحادثة`);

  const { total } = cartTotals(cart);

  return [
    "مرحبا 👋 حابب أعمل هذا الطلب:",
    "",
    ...lines,
    "",
    `المجموع: ${formatPrice(total, currency)}`,
    "",
    "الاسم:",
    "العنوان:",
  ].join("\n");
}

/** The bare chat link — no order attached. Also the empty-cart fallback. */
export function plainOrderHref(phone: string): string {
  return `https://wa.me/${phone}`;
}

/** wa.me link carrying the message. encodeURIComponent handles the Arabic, the
    emoji and the newlines (which become %0A and render as line breaks). */
function orderHref(phone: string, message: string): string {
  return `${plainOrderHref(phone)}?text=${encodeURIComponent(message)}`;
}

/**
 * The href the order button should currently carry.
 *
 * Degrades in three steps, each only reached if the one before it is still too
 * long for MAX_ORDER_URL:
 *   1. the full message
 *   2. compact — same items, no per-line amounts
 *   3. compact and trimmed to the lines that fit, with a closing line stating
 *      how many were left out
 *
 * An empty cart short-circuits to a plain chat link with no text at all.
 */
export function currentOrderHref(cart: Cart, currency: string, phone: string): string {
  if (cart.size === 0) return plainOrderHref(phone);

  const full = orderHref(phone, buildOrderMessage(cart, currency));
  if (full.length <= MAX_ORDER_URL) return full;

  let href = orderHref(phone, buildOrderMessage(cart, currency, { compact: true }));
  if (href.length <= MAX_ORDER_URL) return href;

  // Drop one line at a time until it fits. Bounded by the cart size and only
  // recomputed when the cart changes, so the cost is irrelevant in practice.
  for (let limit = cart.size - 1; limit >= 0; limit -= 1) {
    href = orderHref(phone, buildOrderMessage(cart, currency, { compact: true, limit }));
    if (href.length <= MAX_ORDER_URL) break;
  }
  return href;
}
