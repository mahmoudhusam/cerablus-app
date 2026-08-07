/**
 * Cerablus Coffee — create or reset the single admin login.
 *
 * SINGLE OWNER. There is exactly one AdminUser row. This script upserts it, so
 * running it twice does not create a second admin: the second run UPDATES the
 * existing one. That is deliberate, and it is also the password-recovery path —
 * there is no "forgot password" email flow to build or maintain.
 *
 *   npm run seed-admin
 *
 * INPUT (both optional):
 *   ADMIN_EMAIL      the login email
 *   ADMIN_PASSWORD   the PLAINTEXT password
 *
 * The plaintext is an INPUT ONLY. It is hashed with bcrypt here and only the
 * hash is written; the password is never stored, never logged and never
 * printed. Remove ADMIN_PASSWORD from the environment once you have run this —
 * it has no purpose afterwards, and the running app never reads it.
 *
 * With neither set, the built-in fallback below is used so the script always
 * produces a login that works. That fallback is a KNOWN, PUBLIC credential;
 * see the warning it prints.
 */
import { compare, hash } from "bcryptjs";
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../lib/generated/prisma/client";

// Same order as prisma.config.ts: `.env.local` wins, because dotenv never
// overwrites a variable that is already set.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

/**
 * Used when ADMIN_EMAIL / ADMIN_PASSWORD are not set, so a fresh checkout can
 * always reach the dashboard. These are published in the repo and must not
 * survive into production — the script says so loudly when it uses them.
 */
const FALLBACK_EMAIL = "test@gmail.com";
const FALLBACK_PASSWORD = "admin123456";

/** Matches the cost factor the rest of the app assumes. */
const BCRYPT_COST = 12;

/** The app compares a lowercased, trimmed email; store it the same way. */
function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Cheap sanity check — a typo here locks the owner out of their own dashboard. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createPrisma(): { prisma: PrismaClient; pool: Pool } {
  // The DIRECT (unpooled) Neon URL: this is a one-shot admin script, which
  // wants a real session rather than the transaction-mode pooler the app uses.
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DIRECT_URL / DATABASE_URL is not set. Copy .env.example to .env.local and fill in the Neon connection strings.",
    );
  }

  const pool = new Pool({ connectionString, max: 1 });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

async function main() {
  const usingFallbackEmail = !process.env.ADMIN_EMAIL;
  const usingFallbackPassword = !process.env.ADMIN_PASSWORD;

  const email = normalizeEmail(process.env.ADMIN_EMAIL || FALLBACK_EMAIL);
  const password = process.env.ADMIN_PASSWORD || FALLBACK_PASSWORD;

  if (!looksLikeEmail(email)) {
    throw new Error(`ADMIN_EMAIL does not look like an email address: "${email}"`);
  }
  if (password.length < 8) {
    // Length only — never the value.
    throw new Error(
      `ADMIN_PASSWORD is too short (${password.length} characters, minimum 8). The dashboard enforces the same floor.`,
    );
  }

  const passwordHash = await hash(password, BCRYPT_COST);
  const { prisma, pool } = createPrisma();

  try {
    /* Upsert on the unique email, then delete any OTHER row: this app is
       single-owner, so a previous seed under a different email must not leave a
       second working login behind. */
    const admin = await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash },
      select: { id: true, email: true },
    });

    const removed = await prisma.adminUser.deleteMany({ where: { NOT: { id: admin.id } } });

    // The email is safe to print. The password and the hash are not, and are not.
    console.log(`\nAdmin ready: ${admin.email}`);
    console.log("Password set (not shown). Sign in at /admin/login.");
    if (removed.count > 0) {
      console.log(
        `Removed ${removed.count} other admin row(s) — this app has exactly one owner.`,
      );
    }

    if (usingFallbackEmail || usingFallbackPassword) {
      console.warn(
        [
          "",
          "!! WARNING — built-in fallback credentials are in use.",
          "",
          usingFallbackEmail ? `   ADMIN_EMAIL was not set    -> ${FALLBACK_EMAIL}` : "",
          usingFallbackPassword ? "   ADMIN_PASSWORD was not set -> the published default" : "",
          "",
          "   These are written down in this repository, so anyone who can read it can",
          "   sign in. Fine for local work; NOT safe for the café's live site.",
          "",
          "   Before handover, change them from the dashboard (الحساب), or re-run with:",
          "     ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='a long passphrase' npm run seed-admin",
          "",
        ]
          .filter((line) => line !== "")
          .join("\n"),
      );
    }

    // Prove the row we just wrote actually accepts the password, so a broken
    // hash can never be discovered later at the login screen.
    const stored = await prisma.adminUser.findUnique({
      where: { id: admin.id },
      select: { passwordHash: true },
    });
    const verified = stored ? await compare(password, stored.passwordHash) : false;
    console.log(verified ? "Verified: the stored hash accepts this password.\n" : "");
    if (!verified) throw new Error("The stored hash does not verify — nothing was left usable.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("\nCould not set up the admin.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
