import type { Metadata } from "next";

import "@/styles/admin.css";

/**
 * Chrome for everything under /admin, INCLUDING the login page — so this layout
 * deliberately does not check for a session. The auth check lives one level
 * down, in the (dashboard) group's layout, which wraps every protected page but
 * not /admin/login.
 */
export const metadata: Metadata = {
  // Belt and braces with the middleware gate: even a leaked URL should never
  // end up in a search index.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
