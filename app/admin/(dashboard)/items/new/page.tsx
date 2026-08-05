import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ItemForm } from "@/app/admin/(dashboard)/items/ItemForm";
import { createItemAction } from "@/app/admin/(dashboard)/items/actions";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminCategories } from "@/lib/admin-data";

export const metadata: Metadata = { title: "صنف جديد" };
export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  await requireAdmin();

  const categories = await getAdminCategories();
  // An item must belong to a category, so there is nothing to fill in yet.
  if (categories.length === 0) redirect("/admin/categories");

  return (
    <div className="admin-page admin-page-narrow">
      <div className="admin-page-head">
        <h1>صنف جديد</h1>
        <Link className="admin-btn admin-btn-ghost" href="/admin">
          رجوع للأصناف
        </Link>
      </div>

      <ItemForm action={createItemAction} categories={categories} />
    </div>
  );
}
