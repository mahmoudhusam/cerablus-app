"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import {
  deleteItemAction,
  moveItemAction,
  toggleItemAvailableAction,
} from "@/app/admin/(dashboard)/items/actions";
import type { AdminMenu } from "@/lib/admin-data";
import { formatPrice, normalize } from "@/lib/menu-format";

const CURRENCY = "ل.س";

/** "1,500 ل.س" for a single price, "لشخص · لشخصين — من 650" for a variant item. */
function priceSummary(item: AdminMenu["items"][number]): string {
  if (item.variants.length === 0) {
    return item.price === null ? "—" : formatPrice(item.price, CURRENCY);
  }
  const cheapest = Math.min(...item.variants.map((variant) => variant.price));
  const labels = item.variants.map((variant) => variant.label).join(" · ");
  return `${labels} — من ${formatPrice(cheapest, CURRENCY)}`;
}

/**
 * The owner's list of all 133 items, grouped by category.
 *
 * Search and the category filter are client-side over data the server already
 * sent: with 133 rows that is instant, and it keeps every keystroke off the
 * database. Search reuses the public site's Arabic normalizer, so the owner can
 * type "قهوه" and find "قهوة" exactly as a customer would.
 */
export function ItemsBrowser({ menu }: { menu: AdminMenu }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");

  const indexed = useMemo(
    () => menu.items.map((item) => ({ item, key: normalize(`${item.name} ${item.desc}`) })),
    [menu.items],
  );

  const visible = useMemo(() => {
    const needle = normalize(query);
    return indexed
      .filter(({ item, key }) => {
        if (categoryId !== "all" && item.categoryId !== categoryId) return false;
        if (needle && !key.includes(needle)) return false;
        return true;
      })
      .map(({ item }) => item);
  }, [indexed, query, categoryId]);

  const byCategory = menu.categories
    .map((category) => ({
      category,
      items: visible.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <div className="admin-toolbar">
        <label className="admin-field admin-field-grow">
          <span className="sr-only">ابحث في الأصناف</span>
          <input
            type="search"
            placeholder="ابحث عن صنف…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="admin-field">
          <span className="sr-only">صفّي حسب القسم</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="all">كل الأقسام ({menu.items.length})</option>
            {menu.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.itemCount})
              </option>
            ))}
          </select>
        </label>

        <span className="admin-count" role="status" aria-live="polite">
          {visible.length} صنف
        </span>
      </div>

      {byCategory.length === 0 ? (
        <p className="admin-empty">ما في صنف مطابق.</p>
      ) : (
        byCategory.map(({ category, items }) => (
          <section className="admin-group" key={category.id}>
            <h2 className="admin-group-head">
              {category.name} <span className="admin-count">{items.length}</span>
            </h2>

            <ul className="admin-rows">
              {items.map((item, index) => (
                <li className={item.available ? "admin-row" : "admin-row is-out"} key={item.id}>
                  <div className="admin-row-main">
                    <h3>{item.name}</h3>
                    <span className="admin-row-price">{priceSummary(item)}</span>
                    {item.desc ? <p className="admin-row-desc">{item.desc}</p> : null}
                  </div>

                  <div className="admin-row-badges">
                    {!item.available ? <span className="admin-badge is-out">غير متوفر</span> : null}
                    {item.offer ? <span className="admin-badge is-offer">عرض</span> : null}
                    {item.featured ? <span className="admin-badge is-fav">مميّز</span> : null}
                  </div>

                  <div className="admin-row-tools">
                    {/* Ordering within the category: a swap with the neighbour.
                        Disabled at the ends, and the server no-ops there too. */}
                    <form action={moveItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        className="admin-icon-btn"
                        aria-label={`حرّك ${item.name} لفوق`}
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        className="admin-icon-btn"
                        aria-label={`حرّك ${item.name} لتحت`}
                        disabled={index === items.length - 1}
                      >
                        ↓
                      </button>
                    </form>

                    <form action={toggleItemAvailableAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="admin-btn admin-btn-ghost admin-btn-sm">
                        {item.available ? "علّم غير متوفر" : "علّم متوفر"}
                      </button>
                    </form>

                    <Link className="admin-btn admin-btn-sm" href={`/admin/items/${item.id}`}>
                      تعديل
                    </Link>

                    <form action={deleteItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmSubmit
                        className="admin-btn admin-btn-danger admin-btn-sm"
                        message={`حذف "${item.name}" نهائيًا؟ ما في تراجع.`}
                      >
                        حذف
                      </ConfirmSubmit>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
