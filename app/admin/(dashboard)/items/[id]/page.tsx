import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ItemForm } from "@/app/admin/(dashboard)/items/ItemForm";
import { updateItemAction } from "@/app/admin/(dashboard)/items/actions";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import { deleteItemAction } from "@/app/admin/(dashboard)/items/actions";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminCategories, getAdminItem } from "@/lib/admin-data";

export const metadata: Metadata = { title: "تعديل صنف" };
export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const [item, categories] = await Promise.all([getAdminItem(id), getAdminCategories()]);
  if (!item) notFound();

  return (
    <div className="admin-page admin-page-narrow">
      <div className="admin-page-head">
        <h1>تعديل: {item.name}</h1>
        <Link className="admin-btn admin-btn-ghost" href="/admin">
          رجوع للأصناف
        </Link>
      </div>

      <ItemForm action={updateItemAction} categories={categories} item={item} />

      <form className="admin-danger-zone" action={deleteItemAction}>
        <input type="hidden" name="id" value={item.id} />
        <div>
          <h2>حذف الصنف</h2>
          <p className="admin-hint">بينحذف نهائيًا مع كل أحجامه. ما في تراجع.</p>
        </div>
        <ConfirmSubmit message={`حذف "${item.name}" نهائيًا؟ ما في تراجع.`}>
          احذف هذا الصنف
        </ConfirmSubmit>
      </form>
    </div>
  );
}
