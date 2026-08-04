"use client";

import { useEffect, useRef } from "react";

import { EmptyState } from "@/components/EmptyState";
import { CloseIcon, WhatsAppIcon } from "@/components/icons";
import { formatPrice } from "@/lib/menu-format";
import { type Cart, cartTotals, lineTitle } from "@/lib/menu-order";

/* Everything the tab trap should be able to land on inside the drawer. */
const FOCUSABLE =
  'a[href]:not([tabindex="-1"]), button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/**
 * The cart drawer.
 *
 * Closed state lives in CSS (translated off the inline edge, `visibility:hidden`
 * which also takes it out of the tab order); this component only toggles
 * `.is-open`. While open it locks background scrolling, traps Tab, closes on
 * Escape or an overlay click, and returns focus to the cart button.
 */
export function CartDrawer({
  cart,
  currency,
  orderHref,
  open,
  onClose,
  onQtyChange,
  returnFocusTo,
}: {
  cart: Cart;
  currency: string;
  orderHref: string;
  open: boolean;
  onClose: () => void;
  onQtyChange: (key: string, delta: number) => void;
  /** The control that opened the drawer; focus goes back to it on close. */
  returnFocusTo: React.RefObject<HTMLButtonElement | null>;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { total } = cartTotals(cart);
  const empty = cart.size === 0;

  // Lock the background while the drawer is open.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("is-locked");
    return () => document.body.classList.remove("is-locked");
  }, [open]);

  // Focus the close button rather than the panel: it is the first control, and
  // it gives the keyboard user an immediate way back out. On close, focus goes
  // back to the button that opened the drawer.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) returnFocusTo.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;

    /* The panel is `visibility:hidden` until `.is-open` transitions it in, and
       a hidden element cannot take focus — so focusing on this tick is silently
       dropped and the keyboard user is left behind on the page. Retry once per
       frame until it lands. In practice that is two or three frames; the cap
       stops it spinning if something else ever holds focus. */
    let frames = 0;
    let handle = 0;
    const tryFocus = () => {
      const close = closeRef.current;
      if (!close) return;
      close.focus();
      if (document.activeElement !== close && (frames += 1) < 30) {
        handle = requestAnimationFrame(tryFocus);
      }
    };
    handle = requestAnimationFrame(tryFocus);
    return () => cancelAnimationFrame(handle);
  }, [open, returnFocusTo]);

  // Escape closes; Tab stays inside.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      const drawer = drawerRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !drawer) return;

      const focusables = [...drawer.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (!drawer.contains(active)) {
        // Focus has fallen outside — most often onto <body>, because the −
        // button the user just pressed took the line's quantity to zero and
        // removed the row from under them. Pull it back in.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <div className="drawer-overlay" hidden={!open} onClick={onClose} />

      <aside
        ref={drawerRef}
        className={open ? "drawer is-open" : "drawer"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cartTitle"
        aria-hidden={!open}
      >
        <header className="drawer-head">
          <h2 id="cartTitle">سلّتك</h2>
          <button
            ref={closeRef}
            className="drawer-close"
            type="button"
            aria-label="إغلاق السلة"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="drawer-body">
          {empty ? (
            <EmptyState
              variant="cart"
              title="سلّتك فاضية"
              hint="أضف أصنافك من المنيو وبتظهر هون."
            />
          ) : (
            [...cart.entries()].map(([key, line]) => {
              const title = lineTitle(line);
              return (
                <div className="cart-line" key={key}>
                  <div className="cl-info">
                    <h3 className="cl-name">{line.name}</h3>
                    {line.variantLabel ? (
                      <span className="cl-var">{line.variantLabel}</span>
                    ) : null}
                    <span className="cl-unit">{formatPrice(line.price, currency)}</span>
                  </div>

                  <div className="cl-side">
                    <div className="qty">
                      <button
                        type="button"
                        className="q"
                        // The − at qty 1 removes the line, so say so rather
                        // than "إنقاص".
                        aria-label={line.qty === 1 ? `حذف ${title}` : `إنقاص ${title}`}
                        onClick={() => onQtyChange(key, -1)}
                      >
                        −
                      </button>
                      <span className="q-n">{line.qty}</span>
                      <button
                        type="button"
                        className="q"
                        aria-label={`زيادة ${title}`}
                        onClick={() => onQtyChange(key, 1)}
                      >
                        +
                      </button>
                    </div>
                    <span className="cl-total">
                      {formatPrice(line.price * line.qty, currency)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <footer className="drawer-foot">
          <div className="drawer-total">
            <span>المجموع</span>
            <span className="total">{formatPrice(total, currency)}</span>
          </div>
          {/* The href is rebuilt on every cart change, so the link can never go
              stale against the cart. With an empty cart it is still a valid bare
              chat link — which is also what the server renders, so the button
              works before JS has hydrated the page. Opens in a new tab so the
              in-memory cart survives. */}
          <a
            className={empty ? "order-btn is-disabled" : "order-btn"}
            href={orderHref}
            aria-disabled={empty}
            tabIndex={empty ? -1 : undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon />
            اطلب عبر واتساب
          </a>
        </footer>
      </aside>
    </>
  );
}
