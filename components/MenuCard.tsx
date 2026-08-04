"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  badgeFor,
  formatPrice,
  oldPriceFor,
  variantsOf,
} from "@/lib/menu-format";
import type { MenuItem, MenuVariant } from "@/lib/menu-types";

/* --------------------------------------------------------------------------
   Image zone
   -------------------------------------------------------------------------- */

/**
 * A real photo when the item has one, the branded tile otherwise.
 *
 * A photo that fails to load is hidden (`is-missing`), which reveals the
 * placeholder styled in `.card .top::after` — the customer never sees a broken
 * image icon. Two paths lead there, because a cached-and-broken image fires no
 * error event: the `onError` handler, and a mount-time check for an image the
 * browser has already finished and could not decode.
 */
function ItemImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, [src]);

  /* A plain <img>, not next/image: item photos are arbitrary Cloudinary URLs
     added by the owner at runtime (Step 6), and the placeholder fallback above
     depends on a real element's error behaviour. */
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      className={broken ? "is-missing" : undefined}
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

/* --------------------------------------------------------------------------
   Size pills
   -------------------------------------------------------------------------- */

/**
 * Size pills for a multi-price item. Selecting one updates this card's shown
 * price and tells the add button which variant is live.
 */
function SizePills({
  variants,
  selected,
  onSelect,
}: {
  variants: MenuVariant[];
  selected: MenuVariant;
  onSelect: (variant: MenuVariant) => void;
}) {
  return (
    <div className="sizes">
      {variants.map((variant) => {
        const active = variant.label === selected.label;
        return (
          <button
            key={variant.label}
            type="button"
            className={active ? "size is-active" : "size"}
            aria-pressed={active}
            onClick={() => onSelect(variant)}
          >
            {variant.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Card
   -------------------------------------------------------------------------- */

type MenuCardProps = {
  item: MenuItem;
  currency: string;
  /**
   * The landing page has no cart, so its cards link into /menu instead of
   * carrying a button that could only ever be dead. Omit `onAdd` for that.
   */
  onAdd?: (item: MenuItem, variant: MenuVariant | null) => void;
};

export function MenuCard({ item, currency, onAdd }: MenuCardProps) {
  const variants = variantsOf(item);
  // The variant this card will add. A single-price item leaves it null and the
  // add button falls back to item.price.
  const [selected, setSelected] = useState<MenuVariant | null>(
    variants ? variants[0] : null,
  );
  const [flash, setFlash] = useState(false);

  const outOfStock = !item.available;
  const livePrice = selected ? selected.price : item.price;
  const badge = badgeFor(item);

  /* Struck-through old price.
     ------------------------------------------------------------------------
     VARIANTS + OFFERS: skipped entirely for an item with sizes. The data model
     carries one oldPrice per item, but a multi-size item has several live
     prices and there is no way to tell which one that single number was the
     "before" of. Pairing it with whichever pill happens to be selected would
     misstate the discount every time it is not that size. So a multi-size item
     still gets its عرض badge and simply shows no strikethrough. */
  const previousPrice = variants ? null : oldPriceFor(item, item.price);

  // Brief pulse so a tap has an obvious result. Cleared on unmount so a card
  // filtered away mid-animation cannot set state after it is gone.
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(false), 400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  const handleAdd = useCallback(() => {
    onAdd?.(item, selected);
    setFlash(false);
    // Next frame, so repeat taps restart the animation instead of coalescing.
    requestAnimationFrame(() => setFlash(true));
  }, [item, onAdd, selected]);

  return (
    <article className={outOfStock ? "card is-out" : "card"} data-id={item.id}>
      <div className="top">
        {item.image ? <ItemImage src={item.image} alt={item.name} /> : null}
        {/* Exactly one badge; they all occupy the same corner. See badgeFor(). */}
        {badge ? <span className={badge.className}>{badge.text}</span> : null}
      </div>

      <div className="b">
        <h3>{item.name}</h3>
        <p>{item.desc}</p>

        {variants && selected ? (
          <SizePills variants={variants} selected={selected} onSelect={setSelected} />
        ) : null}

        <div className="r">
          <div className="price-wrap">
            <span className="price">
              {livePrice === null ? "" : formatPrice(livePrice, currency)}
            </span>
            {previousPrice !== null ? (
              <del className="price-old">
                {/* <del> alone announces only "deletion"; name what the number is. */}
                <span className="sr-only">السعر القديم </span>
                {formatPrice(previousPrice, currency)}
              </del>
            ) : null}
          </div>

          {onAdd ? (
            <button
              type="button"
              className={flash ? "add is-added" : "add"}
              // A disabled button fires no click, so an unavailable item stays
              // unaddable even though every card is wired the same way.
              disabled={outOfStock}
              onClick={handleAdd}
            >
              {outOfStock ? "غير متوفر" : "أضف +"}
            </button>
          ) : (
            <Link
              className="add"
              href="/menu"
              // The visible label is short by design; name the item for readers.
              aria-label={`اطلب ${item.name} من المنيو`}
            >
              اطلب
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
