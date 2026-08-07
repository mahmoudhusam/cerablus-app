import type { Metadata } from "next";
import Link from "next/link";

import { AccountForm } from "@/app/admin/(dashboard)/account/AccountForm";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "الحساب" };

/* Per-session and never cached: the owner must see their own account, and the
   moment they change it. */
export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  // Layer 3 — the layout already guarded this page, and it is checked again
  // here so the page stays protected wherever it is moved.
  const admin = await requireAdmin();

  return (
    <div className="admin-page admin-page-narrow">
      <div className="admin-page-head">
        <div>
          <h1>الحساب</h1>
          <p className="admin-lede">غيّر بريدك الإلكتروني وكلمة المرور تبعك.</p>
        </div>
        <Link className="admin-btn admin-btn-ghost" href="/admin">
          رجوع للأصناف
        </Link>
      </div>

      {/* The email comes from the session, not a database read: it is the one
          the owner is signed in with, which is what they are about to change. */}
      <AccountForm email={admin.email} />
    </div>
  );
}
