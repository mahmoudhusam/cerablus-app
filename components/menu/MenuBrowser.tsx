"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CartIcon } from "@/components/icons";
import { CartDrawer } from "@/components/menu/CartDrawer";
import { MenuList } from "@/components/menu/MenuList";
import { MenuToolbar } from "@/components/menu/MenuToolbar";
import { FLAG_CHIPS, isFlagChip, normalize, searchKeyFor } from "@/lib/menu-format";
import {
  type Cart,
  addToCart,
  cartTotals,
  changeQty,
  currentOrderHref,
  lineTitle,
  plainOrderHref,
} from "@/lib/menu-order";
import type { Menu, MenuItem, MenuVariant } from "@/lib/menu-types";

/**
 * The whole menu page's interactive tree.
 *
 * The menu itself is fetched and cached on the server (lib/menu-data.ts) and
 * arrives here as a prop — no database access, no Prisma, nothing server-only
 * in this file or anything it imports. Everything below is view state:
 * search, the active chip, the cart, and the drawer.
 *
 * Header, footer and the cart button live inside this one tree because the
 * cart count in the header and the drawer at the bottom of the page are two
 * views of the same state.
 */
export function MenuBrowser({ menu, phone }: { menu: Menu; phone: string }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [cart, setCart] = useState<Cart>(() => new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  // sr-only live region: visual users read the drawer itself.
  const [cartStatus, setCartStatus] = useState("");

  const cartButtonRef = useRef<HTMLButtonElement>(null);

  /* Normalize every item's searchable text once per menu rather than on every
     keystroke — 133 items × a normalizer with six passes is not free. */
  const indexed = useMemo(
    () => menu.items.map((item) => ({ item, searchKey: searchKeyFor(item) })),
    [menu],
  );

  /* The active chip and the search box apply together — both constraints always
     hold, so searching inside a category narrows rather than resets. */
  const visible = useMemo(() => {
    const needle = normalize(query);
    const flag = isFlagChip(cat) ? FLAG_CHIPS[cat] : null;

    return indexed
      .filter(({ item, searchKey }) => {
        if (flag) {
          if (item[flag] !== true) return false;
        } else if (cat !== "all") {
          if (item.cat !== cat) return false;
        }
        if (needle && !searchKey.includes(needle)) return false;
        return true;
      })
      .map(({ item }) => item);
  }, [indexed, cat, query]);

  // The header shows the count; the drawer computes and shows the money.
  const { count } = cartTotals(cart);

  const orderHref = useMemo(
    () => currentOrderHref(cart, menu.currency, phone),
    [cart, menu.currency, phone],
  );

  /* Both handlers read the current cart from the closure and set a new Map —
     the cart helpers never mutate. Announcing to the live region happens here
     rather than inside a state updater, so it stays a plain effect of the
     click and never runs twice under StrictMode. */
  const handleAdd = useCallback(
    (item: MenuItem, variant: MenuVariant | null) => {
      const result = addToCart(cart, item, variant);
      if (!result) return;
      setCart(result.cart);
      setCartStatus(`${lineTitle(result.line)} — الكمية ${result.line.qty}`);
    },
    [cart],
  );

  const handleQtyChange = useCallback(
    (key: string, delta: number) => {
      const result = changeQty(cart, key, delta);
      if (!result) return;
      setCart(result.cart);
      setCartStatus(
        result.removed
          ? `تم حذف ${lineTitle(result.line)} من السلة`
          : `${lineTitle(result.line)} — الكمية ${result.line.qty}`,
      );
    },
    [cart],
  );

  return (
    <>
      <SiteHeader>
        <div className="nav-actions">
          <button
            ref={cartButtonRef}
            className="cart-btn"
            type="button"
            aria-label={count === 0 ? "سلة الطلب — فاضية" : `سلة الطلب — ${count} صنف`}
            onClick={() => setDrawerOpen(true)}
          >
            <CartIcon />
            {/* The badge disappears rather than sitting at a meaningless zero. */}
            <span className={count === 0 ? "count is-empty" : "count"}>{count}</span>
          </button>
          {/* A bare chat link on purpose: the drawer's own button is the one
              that carries the pre-filled order. */}
          <a
            className="order-cta"
            href={plainOrderHref(phone)}
            target="_blank"
            rel="noopener noreferrer"
          >
            اطلب عبر واتساب
          </a>
        </div>
      </SiteHeader>

      <section className="wrap menu-intro">
        <span className="kick">قائمة اليوم · دمشق</span>
        <h1>المنيو</h1>
        <p>اختَر أصنافك وأضفها للسلة، وابعت طلبك مباشرة عبر واتساب.</p>
      </section>

      <MenuToolbar
        categories={menu.categories}
        activeCat={cat}
        onCatChange={setCat}
        query={query}
        onQueryChange={setQuery}
      />

      <main className="wrap section" id="menuBody">
        <MenuList
          categories={menu.categories}
          items={visible}
          currency={menu.currency}
          showHeadings={cat === "all" || isFlagChip(cat)}
          onAdd={handleAdd}
        />
      </main>

      {/* Result count for screen readers; the visual count lives in each
          category heading. */}
      <p className="sr-only" role="status" aria-live="polite">
        {visible.length ? `${visible.length} صنف` : "ما في نتائج"}
      </p>

      <SiteFooter waHref={plainOrderHref(phone)} />

      <CartDrawer
        cart={cart}
        currency={menu.currency}
        orderHref={orderHref}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onQtyChange={handleQtyChange}
        returnFocusTo={cartButtonRef}
      />

      {/* Cart changes announced to screen readers; the drawer itself is visual. */}
      <p className="sr-only" role="status" aria-live="polite">
        {cartStatus}
      </p>
    </>
  );
}
