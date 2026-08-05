import type { Metadata } from "next";
import Link from "next/link";

import { ItemsBrowser } from "@/app/admin/(dashboard)/ItemsBrowser";
import { Flash } from "@/components/admin/Flash";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminMenu } from "@/lib/admin-data";

export const metadata: Metadata = { title: "الأصناف" };

/* Never prerendered or cached: it is per-session, and the owner must see their
   own edit the moment it lands. The owner is also the one person for whom a
   Neon cold start is acceptable. */
export const dynamic = "force-dynamic";

export default async function AdminItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  // Layer 3 — the layout already guarded this page, and it is checked again
  // here so the page stays protected wherever it is moved.
  await requireAdmin();

  const [menu, params] = await Promise.all([getAdminMenu(), searchParams]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>الأصناف</h1>
          <p className="admin-lede">
            {menu.items.length} صنف في {menu.categories.length} قسم.
          </p>
        </div>
        <div className="admin-page-actions">
          <Link className="admin-btn admin-btn-ghost" href="/admin/categories">
            إدارة الأقسام
          </Link>
          <Link className="admin-btn" href="/admin/items/new">
            + صنف جديد
          </Link>
        </div>
      </div>

      <Flash saved={params.saved} deleted={params.deleted} error={params.error} />

      {menu.categories.length === 0 ? (
        <p className="admin-empty">
          ما في أقسام بعد. <Link href="/admin/categories">أضف قسم</Link> قبل ما تضيف أصناف.
        </p>
      ) : (
        <ItemsBrowser menu={menu} />
      )}
    </div>
  );
}
