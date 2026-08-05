"use client";

import { useActionState, useState } from "react";

import { ConfirmSubmit, SubmitButton } from "@/components/admin/ConfirmSubmit";
import {
  type CategoryFormState,
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from "@/app/admin/(dashboard)/categories/actions";
import type { AdminCategory } from "@/lib/admin-data";

const EMPTY: CategoryFormState = { ok: false, message: null, errors: {} };

/** Inline rename, so the owner never leaves the list to fix a typo. */
function RenameRow({ category }: { category: AdminCategory }) {
  const [state, formAction] = useActionState<CategoryFormState, FormData>(
    renameCategoryAction,
    EMPTY,
  );
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditing(true)}>
        إعادة تسمية
      </button>
    );
  }

  return (
    <form className="admin-inline-form" action={formAction}>
      <input type="hidden" name="id" value={category.id} />
      <label className="admin-field">
        <span className="sr-only">الاسم الجديد لقسم {category.name}</span>
        <input name="name" type="text" defaultValue={category.name} autoFocus />
      </label>
      <SubmitButton className="admin-btn admin-btn-sm" pendingLabel="…">
        احفظ
      </SubmitButton>
      <button
        type="button"
        className="admin-btn admin-btn-ghost admin-btn-sm"
        onClick={() => setEditing(false)}
      >
        إلغاء
      </button>
      {state.errors.name ? <em className="admin-field-error">{state.errors.name}</em> : null}
      {state.message ? (
        <em className={state.ok ? "admin-field-ok" : "admin-field-error"}>{state.message}</em>
      ) : null}
    </form>
  );
}

/**
 * The category manager: order, rename, add, delete.
 *
 * The order here IS the public menu's section order — moving a category up
 * moves that whole section up on /menu.
 *
 * Deleting is deliberately awkward when the category holds items: the confirm
 * names the exact number about to be destroyed, and that number is posted back
 * so the server can refuse if it no longer matches. See deleteCategoryAction.
 */
export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  const [createState, createAction] = useActionState<CategoryFormState, FormData>(
    createCategoryAction,
    EMPTY,
  );

  return (
    <>
      <form className="admin-inline-form admin-create-category" action={createAction}>
        <label className="admin-field admin-field-grow">
          <span>قسم جديد</span>
          <input name="name" type="text" placeholder="اسم القسم" />
        </label>
        <SubmitButton pendingLabel="جاري الإضافة…">أضف قسم</SubmitButton>
        {createState.errors.name ? (
          <em className="admin-field-error">{createState.errors.name}</em>
        ) : null}
        {createState.message ? (
          <em className={createState.ok ? "admin-field-ok" : "admin-field-error"}>
            {createState.message}
          </em>
        ) : null}
      </form>

      <ul className="admin-rows">
        {categories.map((category, index) => (
          <li className="admin-row" key={category.id}>
            <div className="admin-row-main">
              <h3>{category.name}</h3>
              <span className="admin-row-price">
                {category.itemCount} صنف · <code dir="ltr">{category.slug}</code>
              </span>
            </div>

            <div className="admin-row-tools">
              <form action={moveCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="direction" value="up" />
                <button
                  className="admin-icon-btn"
                  aria-label={`حرّك ${category.name} لفوق`}
                  disabled={index === 0}
                >
                  ↑
                </button>
              </form>
              <form action={moveCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  className="admin-icon-btn"
                  aria-label={`حرّك ${category.name} لتحت`}
                  disabled={index === categories.length - 1}
                >
                  ↓
                </button>
              </form>

              <RenameRow category={category} />

              <form action={deleteCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                {/* Echoed back so the server can refuse if the count moved. */}
                <input type="hidden" name="confirmItemCount" value={category.itemCount} />
                <ConfirmSubmit
                  className="admin-btn admin-btn-danger admin-btn-sm"
                  message={
                    category.itemCount === 0
                      ? `حذف قسم "${category.name}"؟`
                      : `تحذير: حذف قسم "${category.name}" رح يحذف معه ${category.itemCount} صنف نهائيًا. ما في تراجع. متأكد؟`
                  }
                >
                  حذف
                </ConfirmSubmit>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
