/**
 * Auth.js's own endpoints (sign in, sign out, session, CSRF).
 *
 * Node runtime, not Edge: authorize() runs bcrypt. This route is deliberately
 * NOT matched by proxy.ts — the login POST has to reach it while signed out.
 */
import { handlers } from "@/lib/auth";

export const runtime = "nodejs";

export const { GET, POST } = handlers;
