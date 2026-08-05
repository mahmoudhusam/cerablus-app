import type { Metadata } from "next";
import Link from "next/link";

import { CategoryManager } from "@/app/admin/(dashboard)/categories/CategoryManager";
import { Flash } from "@/components/admin/Flash";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminCategories } from "@/lib/admin-data";

export const metadata: Metadata = { title: "الأقسام" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string }>;
}) {
  await requireAdmin();

  const [categories, params] = await Promise.all([getAdminCategories(), searchParams]);

  return (
    <div className="admin-page admin-page-narrow">
      <div className="admin-page-head">
        <div>
          <h1>الأقسام</h1>
          <p className="admin-lede">الترتيب هون هو ترتيب الأقسام بالمنيو العام.</p>
        </div>
        <Link className="admin-btn admin-btn-ghost" href="/admin">
          رجوع للأصناف
        </Link>
      </div>

      <Flash deleted={params.deleted} error={params.error} />

      <CategoryManager categories={categories} />
    </div>
  );
}
