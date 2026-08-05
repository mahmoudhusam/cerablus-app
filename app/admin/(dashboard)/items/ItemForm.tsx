"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { SubmitButton } from "@/components/admin/ConfirmSubmit";
import { ImageField } from "@/app/admin/(dashboard)/items/ImageField";
import type { ItemFormState } from "@/app/admin/(dashboard)/items/actions";
import type { AdminCategory, AdminItem } from "@/lib/admin-data";

type VariantRow = { key: string; label: string; price: string };

let rowSeq = 0;
const newRow = (label = "", price = ""): VariantRow => ({
  key: `row-${(rowSeq += 1)}`,
  label,
  price,
});

/**
 * Create/edit form for one menu item.
 *
 * The pricing toggle is the important part: an item has EITHER a single price
 * OR variants, never both and never neither (CLAUDE.md). Switching the toggle
 * swaps which control is rendered, and `pricingMode` is posted alongside so the
 * server reads only the matching shape — a value left behind in the hidden
 * control can never leak into the saved item. The server re-checks all of this
 * regardless; this is only to stop the owner tripping over it.
 */
export function ItemForm({
  action,
  categories,
  item,
}: {
  action: (state: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  categories: AdminCategory[];
  item?: AdminItem;
}) {
  const [state, formAction] = useActionState<ItemFormState, FormData>(action, {
    ok: false,
    message: null,
    errors: {},
  });

  const [pricingMode, setPricingMode] = useState<"single" | "variants">(
    item && item.variants.length > 0 ? "variants" : "single",
  );
  const [offer, setOffer] = useState(item?.offer ?? false);
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    item && item.variants.length > 0
      ? item.variants.map((variant) => newRow(variant.label, String(variant.price)))
      : [newRow()],
  );

  const uid = useId();
  const error = (field: string) => state.errors[field];

  const patchRow = (key: string, patch: Partial<VariantRow>) =>
    setVariants((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const moveRow = (index: number, delta: number) =>
    setVariants((rows) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <form className="admin-form admin-item-form" action={formAction} noValidate>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <input type="hidden" name="pricingMode" value={pricingMode} />

      {state.message ? (
        <p className="admin-flash admin-flash-error" role="alert">
          {state.message}
        </p>
      ) : null}

      {/* ---- identity ---- */}
      <label className="admin-field">
        <span>اسم الصنف</span>
        <input name="name" type="text" defaultValue={item?.name ?? ""} required autoFocus />
        {error("name") ? <em className="admin-field-error">{error("name")}</em> : null}
      </label>

      <label className="admin-field">
        <span>الوصف (اختياري)</span>
        <textarea name="desc" rows={2} defaultValue={item?.desc ?? ""} />
        {error("desc") ? <em className="admin-field-error">{error("desc")}</em> : null}
      </label>

      <label className="admin-field">
        <span>القسم</span>
        <select name="categoryId" defaultValue={item?.categoryId ?? categories[0]?.id ?? ""}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {error("categoryId") ? (
          <em className="admin-field-error">{error("categoryId")}</em>
        ) : null}
      </label>

      {/* ---- pricing ---- */}
      <fieldset className="admin-fieldset">
        <legend>السعر</legend>

        <div className="admin-toggle-row" role="radiogroup" aria-label="نوع التسعير">
          <button
            type="button"
            role="radio"
            aria-checked={pricingMode === "single"}
            className={pricingMode === "single" ? "admin-pill is-active" : "admin-pill"}
            onClick={() => setPricingMode("single")}
          >
            سعر مفرد
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={pricingMode === "variants"}
            className={pricingMode === "variants" ? "admin-pill is-active" : "admin-pill"}
            onClick={() => setPricingMode("variants")}
          >
            أحجام متعددة
          </button>
        </div>

        {pricingMode === "single" ? (
          <label className="admin-field">
            <span>السعر بالليرة السورية</span>
            <input
              name="price"
              type="text"
              inputMode="numeric"
              dir="ltr"
              defaultValue={item?.price != null ? String(item.price) : ""}
              placeholder="مثال: 1500"
            />
            {error("price") ? <em className="admin-field-error">{error("price")}</em> : null}
          </label>
        ) : (
          <div className="admin-variants">
            {error("variants") ? (
              <em className="admin-field-error">{error("variants")}</em>
            ) : null}

            {variants.map((row, index) => (
              <div className="admin-variant-row" key={row.key}>
                <label className="admin-field">
                  <span className="sr-only" id={`${uid}-label-${row.key}`}>
                    اسم الحجم
                  </span>
                  <input
                    name="variantLabel"
                    type="text"
                    placeholder="الحجم (مثال: لشخصين)"
                    aria-labelledby={`${uid}-label-${row.key}`}
                    value={row.label}
                    onChange={(event) => patchRow(row.key, { label: event.target.value })}
                  />
                </label>
                <label className="admin-field admin-field-price">
                  <span className="sr-only" id={`${uid}-price-${row.key}`}>
                    سعر الحجم
                  </span>
                  <input
                    name="variantPrice"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="السعر"
                    aria-labelledby={`${uid}-price-${row.key}`}
                    value={row.price}
                    onChange={(event) => patchRow(row.key, { price: event.target.value })}
                  />
                </label>

                <div className="admin-row-tools">
                  <button
                    type="button"
                    className="admin-icon-btn"
                    aria-label={`حرّك ${row.label || "الحجم"} لفوق`}
                    disabled={index === 0}
                    onClick={() => moveRow(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn"
                    aria-label={`حرّك ${row.label || "الحجم"} لتحت`}
                    disabled={index === variants.length - 1}
                    onClick={() => moveRow(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="admin-icon-btn admin-icon-danger"
                    aria-label={`احذف ${row.label || "الحجم"}`}
                    onClick={() =>
                      setVariants((rows) =>
                        rows.length === 1 ? [newRow()] : rows.filter((r) => r.key !== row.key),
                      )
                    }
                  >
                    ✕
                  </button>
                </div>

                {error(`variants.${index}.label`) ? (
                  <em className="admin-field-error">{error(`variants.${index}.label`)}</em>
                ) : null}
                {error(`variants.${index}.price`) ? (
                  <em className="admin-field-error">{error(`variants.${index}.price`)}</em>
                ) : null}
              </div>
            ))}

            <button
              type="button"
              className="admin-btn admin-btn-ghost"
              onClick={() => setVariants((rows) => [...rows, newRow()])}
            >
              + أضف حجم
            </button>
            <p className="admin-hint">الترتيب هون هو نفسه ترتيب الأحجام على البطاقة.</p>
          </div>
        )}
      </fieldset>

      {/* ---- flags ---- */}
      <fieldset className="admin-fieldset">
        <legend>الحالة</legend>

        <label className="admin-check">
          <input type="checkbox" name="available" defaultChecked={item?.available ?? true} />
          <span>متوفر</span>
        </label>

        <label className="admin-check">
          <input type="checkbox" name="featured" defaultChecked={item?.featured ?? false} />
          <span>مميّز (يظهر بالأكثر طلبًا)</span>
        </label>

        <label className="admin-check">
          <input
            type="checkbox"
            name="offer"
            checked={offer}
            onChange={(event) => setOffer(event.target.checked)}
          />
          <span>عرض</span>
        </label>

        {/* Only meaningful on an offer — and the server clears it when the
            toggle is off, so an old "was" price can't come back later. */}
        {offer ? (
          <label className="admin-field">
            <span>السعر القديم (يظهر مشطوب)</span>
            <input
              name="oldPrice"
              type="text"
              inputMode="numeric"
              dir="ltr"
              defaultValue={item?.oldPrice != null ? String(item.oldPrice) : ""}
              placeholder="لازم يكون أعلى من السعر الحالي"
            />
            {error("oldPrice") ? (
              <em className="admin-field-error">{error("oldPrice")}</em>
            ) : null}
            {pricingMode === "variants" ? (
              <em className="admin-hint">
                الصنف بأحجام: بيظهر شارة &laquo;عرض&raquo; بس بدون سعر مشطوب.
              </em>
            ) : null}
          </label>
        ) : null}
      </fieldset>

      {/* ---- image ----
           Upload needs an item to attach to, so a brand-new item is saved
           first and photographed after. Everything here lives outside the
           form's submit: the photo is saved the moment it uploads, not when
           the editor is saved. */}
      <fieldset className="admin-fieldset" aria-describedby={`${uid}-image-note`}>
        <legend>الصورة</legend>
        {item ? (
          <ImageField itemId={item.id} imageUrl={item.imageUrl} itemName={item.name} />
        ) : (
          <div className="admin-image-placeholder">
            <span className="admin-image-empty" aria-hidden="true" />
            <p className="admin-hint" id={`${uid}-image-note`}>
              احفظ الصنف أول، وبعدها بتقدر ترفع صورته من صفحة التعديل. لحد ما ترفع صورة،
              البطاقة بتعرض شعار Cerablus.
            </p>
          </div>
        )}
      </fieldset>

      <div className="admin-form-actions">
        <SubmitButton pendingLabel="جاري الحفظ…">
          {item ? "احفظ التعديلات" : "أضف الصنف"}
        </SubmitButton>
        <Link className="admin-btn admin-btn-ghost" href="/admin">
          إلغاء
        </Link>
      </div>
    </form>
  );
}
