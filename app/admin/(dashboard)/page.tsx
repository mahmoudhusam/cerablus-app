import type { Metadata } from "next";

import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "لوحة التحكم",
};

/* The admin must never be prerendered or cached: it is per-session by
   definition, and a cached copy of a signed-in page is a copy that could be
   served to someone who is not signed in. Unlike the public pages, the owner
   IS allowed to wait on a Neon cold start. */
export const dynamic = "force-dynamic";

/**
 * The admin shell.
 *
 * Step 4 stops here on purpose: a heading, who is signed in, what is in the
 * database, and a way out. No editing — that is Step 5.
 */
export default async function AdminDashboardPage() {
  /* LAYER 3. The parent layout already called requireAdmin(), so on the happy
     path this is redundant — deliberately. It is the pattern every Step 5
     server action and route handler will follow, and it means this page stays
     protected even if it is ever moved out from under that layout. */
  const admin = await requireAdmin();

  const [categories, items, variants] = await Promise.all([
    prisma.category.count(),
    prisma.item.count(),
    prisma.variant.count(),
  ]);

  return (
    <div className="admin-page">
      <h1>لوحة التحكم</h1>
      <p className="admin-lede">أهلًا {admin.username} — هذه نظرة سريعة على المنيو.</p>

      <div className="admin-stats">
        <div className="admin-stat">
          <span className="n">{items}</span>
          <span className="l">صنف</span>
        </div>
        <div className="admin-stat">
          <span className="n">{categories}</span>
          <span className="l">قسم</span>
        </div>
        <div className="admin-stat">
          <span className="n">{variants}</span>
          <span className="l">حجم / خيار</span>
        </div>
      </div>

      <p className="admin-note">
        إدارة الأصناف والأقسام بتجي بالخطوة الجاي. لهلق، المنيو بينقرأ من قاعدة
        البيانات وبيتعدّل بس عن طريق سكربت التعبئة.
      </p>
    </div>
  );
}
