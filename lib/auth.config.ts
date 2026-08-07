/**
 * Auth.js configuration — the EDGE-SAFE half.
 *
 * Middleware runs on the Edge runtime, where bcrypt and Prisma cannot go. So the
 * config is split in two:
 *
 *   - this file: session strategy, cookies, the route-gate callback. No Node
 *     APIs, no providers, no database. Imported by middleware.ts.
 *   - lib/auth.ts: the same object PLUS the Credentials provider, whose
 *     authorize() does the bcrypt compare. Runs only in the Node runtime.
 *
 * Middleware can therefore check "is there a valid session cookie?" cheaply on
 * every /admin request, while the actual password check stays server-side.
 */
import type { NextAuthConfig } from "next-auth";

/** Where an unauthenticated visitor is sent. */
export const LOGIN_PATH = "/admin/login";

/** Where a successful login lands. */
export const ADMIN_HOME = "/admin";

/**
 * How long a login lasts. Eight hours is about one working day: long enough
 * that the owner is not re-typing a password all shift, short enough that a
 * forgotten session on a shared machine expires the same day.
 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

/**
 * Secure cookies require HTTPS, so turning them on over plain HTTP would break
 * login outright. Decide from NEXTAUTH_URL's scheme when it is set (that is the
 * origin this deployment actually serves), and fall back to the build mode.
 */
function secureCookiesEnabled(): boolean {
  const url = process.env.NEXTAUTH_URL;
  if (url) {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      // A malformed URL is a config error, not a reason to weaken the default.
    }
  }
  return process.env.NODE_ENV === "production";
}

const secure = secureCookiesEnabled();

export const authConfig = {
  // Explicit rather than relying on Auth.js v5's AUTH_SECRET default, so the
  // variable name in .env.example is the one that is actually read.
  secret: process.env.NEXTAUTH_SECRET,

  // Self-hosted / non-Vercel deployments need this to accept the request's Host
  // header. NEXTAUTH_URL still pins the canonical origin used in callbacks.
  trustHost: true,

  // No database session table — this app has exactly one user, so a signed JWT
  // in an httpOnly cookie is the whole session store.
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 60 * 60, // refresh the cookie at most hourly while in use
  },
  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },

  pages: {
    signIn: LOGIN_PATH,
    error: LOGIN_PATH, // never show Auth.js's own error page to a customer
  },

  /* These match Auth.js's own defaults; they are spelled out so the security
     properties of the session cookie are reviewable in one place rather than
     inherited invisibly.
       httpOnly  — JavaScript can never read the session token.
       sameSite  — "lax" blocks cross-site POSTs while keeping normal
                   top-level navigation to /admin working.
       secure    — HTTPS only, whenever we are actually on HTTPS.
       path "/"  — the cookie must also reach /api/admin/* in Step 5. */
  cookies: {
    sessionToken: {
      name: `${secure ? "__Secure-" : ""}authjs.session-token`,
      options: { httpOnly: true, sameSite: "lax", path: "/", secure },
    },
  },

  callbacks: {
    /**
     * The middleware gate (layer 1 of 3 — see lib/admin-auth.ts).
     *
     * Runs on every request matched by middleware.ts. Returning false makes
     * Auth.js redirect to `pages.signIn` with a callbackUrl, so a deep link to
     * an admin page survives the detour through login.
     */
    authorized({ auth, request }) {
      const signedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      if (pathname === LOGIN_PATH) {
        // Already signed in? The login form has nothing to offer.
        if (signedIn) {
          return Response.redirect(new URL(ADMIN_HOME, request.nextUrl));
        }
        return true;
      }

      return signedIn;
    },

    /**
     * Carry the owner's id and email on the token: the id is what the account
     * page updates, the email is what the shell greets them with. Only these
     * two — the password hash must never reach a token that travels to the
     * browser.
     */
    jwt({ token, user }) {
      if (user) {
        token.adminId = user.id ?? undefined;
        token.email = user.email ?? undefined;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.adminId as string | undefined) ?? session.user.id;
        session.user.email = (token.email as string | undefined) ?? session.user.email;
        session.user.name = session.user.email;
      }
      return session;
    },
  },

  // Filled in by lib/auth.ts. Middleware only reads the session cookie, so it
  // never needs a provider — and must not pull bcrypt into the Edge bundle.
  providers: [],
} satisfies NextAuthConfig;
