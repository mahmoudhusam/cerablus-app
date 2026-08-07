/**
 * Auth.js — the NODE-runtime half: the Credentials provider and the actual
 * password check. See lib/auth.config.ts for why the config is split.
 *
 * SINGLE OWNER. There is no sign-up, no roles and no password-reset email. One
 * AdminUser row holds the login email and a bcrypt hash; a successful compare
 * is the entire authorization model.
 *
 * The credentials moved OUT of the environment and INTO the database, so the
 * owner can change their own email and password from the dashboard without a
 * redeploy. `scripts/seed-admin.ts` creates or resets that row; ADMIN_USERNAME
 * and ADMIN_PASSWORD_HASH are no longer read by the login path at all.
 */
import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { clientKeyFrom, consume, reset, type RateLimitOptions } from "@/lib/rate-limit";

/**
 * Login budget: 5 attempts per 10 minutes per client address, reset by a
 * successful login — so at most ~30 guesses an hour from one address. Online
 * guessing is not a viable path to this password.
 *
 * It also bounds the CPU an attacker can spend for us: bcryptjs is pure
 * JavaScript, and a cost-12 compare measures ~1.7s on this hardware, so every
 * attempt is real work. Five per ten minutes per address keeps that to a few
 * seconds of CPU; a distributed attacker could still exceed it, which is the
 * limiter's honest ceiling (see lib/rate-limit.ts).
 */
export const LOGIN_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
};

/** Namespaced so a future limiter on another route cannot collide with this one. */
export function loginRateLimitKey(headers: Headers): string {
  return `login:${clientKeyFrom(headers)}`;
}

/**
 * A syntactically valid bcrypt hash, used ONLY to keep the work constant when
 * no admin row matches the submitted email. It is not a credential and unlocks
 * nothing: it is the hash of a random string nobody kept.
 *
 * Without it, an unknown email would answer instantly while a known one paid
 * for a ~1.7s bcrypt compare — which turns the login form into an oracle for
 * "does this email have an account here".
 */
const PLACEHOLDER_HASH = "$2b$12$45zKYEKTf0uiUZUCdV6Ssudup.tRl4zL3hY2XmvTZ4EfDSERMlove";

/**
 * The app stores and compares a lowercased, trimmed email. Doing it here as
 * well as in the seed script means the owner can type Owner@Example.com and
 * still get in.
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Constant-time string comparison.
 *
 * `===` would return as soon as two bytes differ, letting an attacker recover
 * the value character by character from response timing. Both sides are hashed
 * to a fixed 32 bytes first so the comparison also cannot leak the value's
 * LENGTH, which a raw timingSafeEqual would (it throws on a length mismatch).
 */
async function constantTimeEquals(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);

  const x = new Uint8Array(left);
  const y = new Uint8Array(right);
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },

      /**
       * Returns the owner on success, null on any failure.
       *
       * Auth.js turns every null into the same CredentialsSignin error, and the
       * login page renders one generic Arabic message — so the response never
       * says whether the email or the password was the problem.
       *
       * The password is never logged, never returned, and never compared as
       * plaintext.
       */
      async authorize(credentials, request) {
        // Authoritative rate limit. It sits HERE rather than only in the login
        // action because this is the code path a direct POST to
        // /api/auth/callback/credentials reaches.
        const key = loginRateLimitKey(request.headers);
        if (!consume(key, LOGIN_RATE_LIMIT).allowed) return null;

        const email = normalizeEmail(
          typeof credentials?.email === "string" ? credentials.email : "",
        );
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        /* A database lookup, not an environment variable. A failure here (Neon
           asleep, network gone) must read as "login failed", never as a stack
           trace on the login screen. */
        let admin: { id: string; email: string; passwordHash: string } | null = null;
        try {
          admin = await prisma.adminUser.findUnique({
            where: { email },
            select: { id: true, email: true, passwordHash: true },
          });
        } catch (error) {
          // The message only; a connection error can carry the URL — and
          // therefore the password — in its payload.
          console.error(
            "[cerablus] could not read the admin account during login.",
            error instanceof Error ? error.message : error,
          );
          return null;
        }

        if (!admin) {
          console.error(
            "[cerablus] login attempted but no admin account matched. If none exists yet, run `npm run seed-admin`.",
          );
        }

        /* Both checks always run, and the bcrypt compare always runs against a
           well-formed hash. An unknown email therefore costs exactly what a
           wrong password costs, so response time is not an oracle for "does
           this account exist". */
        const [emailMatches, passwordMatches] = await Promise.all([
          constantTimeEquals(email, admin?.email ?? ""),
          compare(password, admin?.passwordHash ?? PLACEHOLDER_HASH),
        ]);

        if (!admin || !emailMatches || !passwordMatches) return null;

        // Clean slate for the owner's next login from this address.
        reset(key);

        // Everything returned here ends up in the JWT and reaches the browser.
        // The id and email are all the shell needs; the hash never leaves here.
        return { id: admin.id, email: admin.email, name: admin.email };
      },
    }),
  ],
});
