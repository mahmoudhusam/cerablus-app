import { logoutAction } from "@/app/admin/actions";
import { CerablusMark } from "@/components/brand/CerablusMark";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * LAYER 2 of the admin guard: the server-side session check.
 *
 * `(dashboard)` is a route group, so it adds nothing to the URL — /admin still
 * resolves to (dashboard)/page.tsx — but it gives every protected page a
 * common parent that the login page does not share.
 *
 * This runs on the server on every request to a protected page. It is NOT a
 * duplicate of the middleware gate: middleware depends on a matcher pattern
 * being correct, while this sits directly in the render path and cannot be
 * routed around. Either one alone would keep the admin shut.
 *
 * It is still not the last word — Step 5's mutations call requireAdmin()
 * themselves (layer 3), because a layout guards a page, not a server action.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <>
      <header className="admin-bar">
        <div className="admin-bar-inner">
          <div className="admin-brand">
            <span className="mark">
              <span className="cmark">
                <CerablusMark />
              </span>
            </span>
            <span className="name">Cerablus</span>
            <span className="admin-tag">لوحة التحكم</span>
          </div>

          <div className="admin-bar-actions">
            <span className="admin-who">{admin.username}</span>
            {/* A form POST, not a link: signing out is a state change and must
                not be triggerable by a prefetch or a stray GET. */}
            <form action={logoutAction}>
              <button className="admin-signout" type="submit">
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="admin-main">{children}</main>
    </>
  );
}
