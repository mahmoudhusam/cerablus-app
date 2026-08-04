/**
 * LAYER 1 of the admin guard: the edge gate.
 *
 * Every request to an /admin page or a (future) /api/admin route passes through
 * here before any page code runs. Unauthenticated requests are redirected to
 * /admin/login by the `authorized` callback in lib/auth.config.ts, so a
 * protected page never even begins to render.
 *
 * (Next 16 renamed this convention from `middleware.ts` to `proxy.ts`; it is
 * the same request interceptor, and Auth.js's `auth` is a plain handler
 * function, so it drops straight in.)
 *
 * This is the CHEAPEST guard, not the authoritative one. It only inspects the
 * session cookie, it runs on the Edge runtime where bcrypt and Prisma cannot
 * go, and a mistyped matcher would silently stop covering a route. So the pages
 * check again (layer 2) and every mutation calls requireAdmin() (layer 3).
 * See lib/admin-auth.ts.
 */
import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// Assigned before export: Next statically checks that this file exports a
// function, and does not recognise an inline destructured export as one.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  /* /admin and everything under it, plus the /api/admin namespace Step 5's
     mutations will live in. Auth.js's own /api/auth/* routes are deliberately
     NOT matched — the login POST has to reach them while signed out.
     `:path*` matches zero or more segments, so this covers bare /admin too. */
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
