/**
 * Auth.js — the NODE-runtime half: the Credentials provider and the actual
 * password check. See lib/auth.config.ts for why the config is split.
 *
 * SINGLE OWNER. There is no user table, no sign-up, no roles and no password
 * reset. One username and one bcrypt hash live in environment variables; a
 * successful compare is the entire authorization model.
 */
import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/lib/auth.config";
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
 * ADMIN_PASSWORD_HASH is missing. It is not a credential and unlocks nothing:
 * it is the hash of a random string nobody kept. Without it, an unconfigured
 * deployment would answer instantly and advertise that fact.
 */
const PLACEHOLDER_HASH = "$2b$12$45zKYEKTf0uiUZUCdV6Ssudup.tRl4zL3hY2XmvTZ4EfDSERMlove";

/** `$2b$12$` + a 22-character salt + a 31-character digest. */
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * Check that ADMIN_PASSWORD_HASH still looks like a bcrypt hash, and explain it
 * clearly if not.
 *
 * This exists because of a trap that costs hours otherwise: Next.js runs every
 * `.env*` value through dotenv-expand, which treats `$` as the start of a
 * variable reference. A bcrypt hash is full of them, so `$2b$12$abc…` silently
 * becomes a shorter, wrong string — and quoting does NOT save it. The hash has
 * to be written with each `$` backslash-escaped:
 *
 *   ADMIN_PASSWORD_HASH="\$2b\$12\$abc…"
 *
 * (`npm run hash-password` prints it that way. A value set in Vercel's
 * dashboard is not parsed by dotenv and takes the hash verbatim.)
 *
 * Without this check the only symptom is "بيانات الدخول غير صحيحة" for a
 * password that is perfectly correct.
 */
function checkHashShape(hash: string): boolean {
  if (BCRYPT_HASH.test(hash)) return true;

  // Length and shape only — never the value itself.
  console.error(
    `[cerablus] ADMIN_PASSWORD_HASH is not a valid bcrypt hash (length ${hash.length}, expected 60). ` +
      "If you set it in a .env file, escape every $ as \\$ — Next.js expands unescaped $ as a variable " +
      "and silently truncates the hash. Re-run `npm run hash-password` and copy the .env line it prints.",
  );
  return false;
}

/**
 * Constant-time string comparison.
 *
 * `===` on the username would return as soon as two bytes differ, letting an
 * attacker recover it character by character from response timing. Both sides
 * are hashed to a fixed 32 bytes first so the comparison also cannot leak the
 * username's LENGTH, which a raw timingSafeEqual would (it throws on a length
 * mismatch).
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
        username: { label: "اسم المستخدم", type: "text" },
        password: { label: "كلمة المرور", type: "password" },
      },

      /**
       * Returns the owner on success, null on any failure.
       *
       * Auth.js turns every null into the same CredentialsSignin error, and the
       * login page renders one generic Arabic message — so the response never
       * says whether the username or the password was the problem.
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

        const username = typeof credentials?.username === "string" ? credentials.username : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!username || !password) return null;

        const expectedUsername = process.env.ADMIN_USERNAME ?? "";
        const expectedHash = process.env.ADMIN_PASSWORD_HASH ?? "";

        /* Configuration problems are reported by name, never by value, and
           never abort early — a login against a misconfigured server must still
           take the same time as any other failed login. */
        const configured =
          Boolean(expectedUsername) && Boolean(expectedHash) && checkHashShape(expectedHash);

        if (!expectedUsername || !expectedHash) {
          console.error(
            "[cerablus] admin login is not configured — set ADMIN_USERNAME and ADMIN_PASSWORD_HASH.",
          );
        }

        /* Both checks always run, and the bcrypt compare always runs against a
           well-formed hash. A wrong username therefore costs exactly what a
           wrong password costs, so response time is not an oracle for "does
           this username exist". */
        const [usernameMatches, passwordMatches] = await Promise.all([
          constantTimeEquals(username, expectedUsername),
          compare(password, configured ? expectedHash : PLACEHOLDER_HASH),
        ]);

        if (!configured || !usernameMatches || !passwordMatches) return null;

        // Clean slate for the owner's next login from this address.
        reset(key);

        // Everything returned here ends up in the JWT and reaches the browser.
        // The username is all the shell needs; nothing else belongs in it.
        return { id: "owner", name: expectedUsername };
      },
    }),
  ],
});
