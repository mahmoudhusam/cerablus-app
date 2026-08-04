"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";

import { LOGIN_PATH } from "@/lib/auth.config";
import { LOGIN_RATE_LIMIT, loginRateLimitKey, signIn, signOut } from "@/lib/auth";
import { peek } from "@/lib/rate-limit";

/**
 * The ONE error the login form ever shows.
 *
 * Wrong username, wrong password, unknown username, unconfigured server — all
 * of them land here. Nothing in the response distinguishes them, so the form
 * cannot be used to discover whether a username exists.
 */
const GENERIC_ERROR = "بيانات الدخول غير صحيحة";

const RATE_LIMITED_ERROR = "محاولات كتيرة. جرّب مرة تانية بعد شوي.";

export type LoginState = { error: string | null };

/**
 * Sign the owner in.
 *
 * On success `signIn` throws Next's redirect signal, which must reach the
 * framework — hence catching AuthError specifically and rethrowing everything
 * else.
 */
export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  /* Read the budget without spending it, purely so a locked-out owner gets a
     message that tells them to wait rather than the generic "wrong details".
     The budget is actually SPENT inside authorize(), which is the path a direct
     POST to the Auth.js callback endpoint also takes — so skipping this form
     buys an attacker nothing. */
  if (!peek(loginRateLimitKey(await headers()), LOGIN_RATE_LIMIT).allowed) {
    return { error: RATE_LIMITED_ERROR };
  }

  try {
    // redirectTo is a fixed internal path, never anything from the request, so
    // this cannot be turned into an open redirect.
    await signIn("credentials", { username, password, redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) return { error: GENERIC_ERROR };
    throw error;
  }

  // Unreachable: signIn either redirects or throws.
  return { error: null };
}

/** Clear the session and return to the login page. */
export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: LOGIN_PATH });
}
