"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MenuCard } from "@/components/MenuCard";
import { FLAG_CHIPS, isFlagChip } from "@/lib/menu-format";
import type { Menu, MenuItem } from "@/lib/menu-types";

/* How many items the teaser row shows. */
const PREVIEW_LIMIT = 4;

/* How many real category chips sit beside the two flag chips. The full
   16-category list lives on the menu page; the landing stays a short teaser, so
   it leads with a few categories and the "شوف المنيو كامل" link carries the
   rest. */
const PREVIEW_CATEGORY_CHIPS = 3;

/**
 * The items the landing page shows off, honouring the active chip.
 *
 * Same filtering semantics as the menu page — a flag chip tests an item flag, a
 * category chip matches `item.cat` — so the preview and the menu can never
 * disagree about what a chip means. Two rules hold across every filter:
 * unavailable items never appear (the landing page is a shop window; there is
 * no point advertising what the café cannot serve today), and the row is capped
 * at PREVIEW_LIMIT.
 *
 * الأكثر طلبًا shows مميّز items first, then tops up in menu order, so a menu
 * with only two flagged items still gets a full row rather than a gap-toothed
 * one. That same featured-first ordering is the empty-safe fallback — if a
 * stricter filter (say العروض with nothing on offer today) matches nothing, it
 * is shown instead of leaving a blank hole. So the row is only ever empty when
 * the whole menu is.
 */
function previewItems(items: MenuItem[], filter: string): MenuItem[] {
  const sellable = items.filter((item) => item.available);

  const featuredFirst = () => [
    ...sellable.filter((item) => item.featured),
    ...sellable.filter((item) => !item.featured),
  ];

  let matched: MenuItem[];
  if (filter === "featured") {
    matched = featuredFirst();
  } else if (isFlagChip(filter)) {
    matched = sellable.filter((item) => item[FLAG_CHIPS[filter]] === true);
  } else {
    matched = sellable.filter((item) => item.cat === filter);
  }

  if (matched.length === 0) matched = featuredFirst();
  return matched.slice(0, PREVIEW_LIMIT);
}

/**
 * The landing page's "من قائمتنا" teaser: a filter chip row over a short row of
 * the same cards the menu page renders, from the same data — so a price shown
 * here can never drift from the menu's.
 *
 * These cards link into /menu rather than carrying an add button: there is no
 * cart on this page, so a button could only ever be dead.
 */
export function PreviewSection({ menu }: { menu: Menu }) {
  const [filter, setFilter] = useState("featured");

  const chips = [
    { cat: "featured", label: "الأكثر طلبًا" },
    { cat: "offers", label: "العروض" },
    ...menu.categories.slice(0, PREVIEW_CATEGORY_CHIPS).map((category) => ({
      cat: category.id,
      label: category.name,
    })),
  ];

  const shown = useMemo(() => previewItems(menu.items, filter), [menu.items, filter]);

  return (
    <section className="wrap section" id="menu">
      <div className="sec-head">
        <h2>
          من <span className="u">قائمتنا</span>
        </h2>
        <div className="chips" role="group" aria-label="تصفية المعروضات">
          {chips.map((chip) => {
            const active = chip.cat === filter;
            return (
              <button
                key={chip.cat}
                type="button"
                className={active ? "chip is-active" : "chip"}
                aria-pressed={active}
                onClick={() => setFilter(chip.cat)}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid" id="previewGrid">
        {shown.map((item) => (
          <MenuCard key={item.id} item={item} currency={menu.currency} />
        ))}
      </div>

      <p className="sec-more">
        <Link className="btn-ghost" href="/menu">
          شوف المنيو كامل
        </Link>
      </p>
    </section>
  );
}
