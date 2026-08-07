/**
 * SERVER ONLY — the admin authorization helpers.
 *
 * THE THREE LAYERS
 * ----------------
 *   1. middleware.ts          — edge gate on /admin/* and /api/admin/*.
 *                               Cheap, runs first, redirects before any page
 *                               code executes. Depends on a matcher being
 *                               right, so it is never trusted alone.
 *   2. app/admin/(dashboard)/layout.tsx
 *                             — calls requireAdmin() before rendering any
 *                               protected page. Catches anything the matcher
 *                               misses, and anything that reaches the app
 *                               without passing through middleware.
 *   3. requireAdmin() at the point of use
 *                             — every protected page and, from Step 5, EVERY
 *                               server action and route handler that mutates
 *                               data. This is the authoritative check: it reads
 *                               the signed session directly and is the only one
 *                               that sits on the same code path as the write it
 *                               is protecting.
 *
 * A layer can be removed and the others still hold. That is the point: the UI
 * must never be the only thing standing between the public and a mutation.
 */
import { redirect } from "next/navigation";

import { LOGIN_PATH } from "@/lib/auth.config";
import { auth } from "@/lib/auth";

/**
 * The signed-in owner. Deliberately tiny — there is only ever one, and nothing
 * about the credential (never the hash) belongs in here.
 */
export type AdminUser = {
  /** AdminUser.id — what the account page updates. */
  id: string;
  /** The login email, also what the dashboard shell displays. */
  email: string;
};

/** The current owner, or null when there is no valid session. */
export async function getAdminSession(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const id = session.user.id ?? "";
  const email = session.user.email ?? "";
  // A session that carries neither is not a usable identity — treat it as
  // signed out rather than handing back a blank owner.
  if (!id || !email) return null;

  return { id, email };
}

/**
 * Require a signed-in owner, or redirect to the login page.
 *
 * For server components and server actions. `redirect()` throws, so nothing
 * after this call runs without a valid session — including in a server action,
 * where the redirect becomes the action's response.
 *
 * Step 5: call this as the FIRST statement of every admin mutation. Do not
 * guard a mutation by hiding its button.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminSession();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/**
 * The same check for route handlers, which want a status code rather than a
 * redirect to an HTML page.
 *
 * Returns the owner, or a 401 Response to return as-is:
 *
 *   const guard = await requireAdminApi();
 *   if (guard instanceof Response) return guard;
 */
export async function requireAdminApi(): Promise<AdminUser | Response> {
  const user = await getAdminSession();
  if (user) return user;

  return Response.json(
    { error: "unauthorized" },
    { status: 401, headers: { "cache-control": "no-store" } },
  );
}
