"use client";

import { EmptyState } from "@/components/EmptyState";
import { MenuCard } from "@/components/MenuCard";
import type { MenuCategory, MenuItem, MenuVariant } from "@/lib/menu-types";

/**
 * The filtered menu, grouped into its category sections.
 *
 * `showHeadings` is false when a single category chip is active: the chip
 * already names the section, so the heading would just repeat it. Headings stay
 * for الكل and for the flag chips (الأكثر طلبًا, العروض), whose results span
 * several categories and so keep the grouping meaningful.
 */
export function MenuList({
  categories,
  items,
  currency,
  showHeadings,
  onAdd,
}: {
  categories: MenuCategory[];
  items: MenuItem[];
  currency: string;
  showHeadings: boolean;
  onAdd: (item: MenuItem, variant: MenuVariant | null) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState title="ما في نتائج" hint="جرّب كلمة تانية، أو اختر قسم من فوق." />
    );
  }

  return (
    <>
      {categories.map((category) => {
        const inCategory = items.filter((item) => item.cat === category.id);
        if (inCategory.length === 0) return null; // skip empty categories entirely

        return (
          <section
            key={category.id}
            className="cat"
            id={`cat-${category.id}`}
            aria-label={category.name}
          >
            {showHeadings ? (
              <h2 className="cat-head">
                {category.name} <span className="count">{inCategory.length}</span>
              </h2>
            ) : null}
            <div className="menu-grid">
              {inCategory.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  currency={currency}
                  onAdd={onAdd}
                />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
