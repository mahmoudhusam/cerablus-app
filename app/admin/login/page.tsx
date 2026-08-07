import type { Metadata } from "next";

import { LoginForm } from "@/app/admin/login/LoginForm";
import { CerablusMark } from "@/components/brand/CerablusMark";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
  // The admin must never be indexed, linked to, or previewed.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The only page under /admin that does not require a session.
 *
 * It sits OUTSIDE the (dashboard) route group, so the group's
 * requireAdmin() layout does not wrap it — otherwise logging in would require
 * already being logged in. Middleware allows this exact path (and bounces an
 * already-signed-in owner on to /admin).
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  // Set by the account page after a successful credential change, which signs
  // the owner out on purpose. Without this the redirect looks like a rejection.
  const { updated } = await searchParams;

  return (
    <main className="admin-auth">
      <div className="admin-card">
        <div className="admin-brand">
          <span className="mark">
            <span className="cmark">
              <CerablusMark />
            </span>
          </span>
          <span className="name">Cerablus</span>
        </div>

        <h1>لوحة التحكم</h1>
        <p className="admin-lede">سجّل دخولك لإدارة المنيو.</p>

        {updated ? (
          <p className="admin-flash admin-flash-ok" role="status">
            تم تحديث بيانات الدخول. سجّل دخولك ببياناتك الجديدة.
          </p>
        ) : null}

        <LoginForm />
      </div>
    </main>
  );
}
