"use server";

/**
 * Change the owner's own login email and password.
 *
 * Same rule as every other mutation: `await requireAdmin()` is the FIRST
 * statement, before any input is read or any query runs. A server action is its
 * own POST endpoint and is reachable without ever rendering the page.
 *
 * NOTHING here is logged. Not the current password, not the new one, not the
 * hash — the only value that ever reaches a log or a response is the email.
 */
import { compare, hash } from "bcryptjs";

import { requireAdmin } from "@/lib/admin-auth";
import { accountSchema, fieldErrors } from "@/lib/admin-schemas";
import { normalizeEmail, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Matches scripts/seed-admin.ts, so a rotated password is as strong as a seeded one. */
const BCRYPT_COST = 12;

export type AccountFormState = {
  ok: boolean;
  message: string | null;
  errors: Record<string, string>;
};

export async function updateAccountAction(
  _previous: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const admin = await requireAdmin();

  const parsed = accountSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    email: formData.get("email") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "في أخطاء بالنموذج — صلّحها وجرّب مرة تانية.",
      errors: fieldErrors(parsed.error),
    };
  }
  const input = parsed.data;

  // Re-read the row rather than trusting the session: the session was minted at
  // login and the hash it must be checked against is only in the database.
  const current = await prisma.adminUser.findUnique({
    where: { id: admin.id },
    select: { id: true, passwordHash: true },
  });
  if (!current) {
    return { ok: false, message: "الحساب غير موجود.", errors: {} };
  }

  /* Proof of possession. Without this, anyone who reached an unlocked browser
     could silently take the account over by changing both the email and the
     password. The error is attached to the field so it reads as a correction,
     not as a system failure. */
  const currentMatches = await compare(input.currentPassword, current.passwordHash);
  if (!currentMatches) {
    return {
      ok: false,
      message: null,
      errors: { currentPassword: "كلمة المرور الحالية غير صحيحة" },
    };
  }

  const email = normalizeEmail(input.email);

  /* The email is unique in the schema. Practically unreachable with one owner,
     but a clear message beats a raw Prisma constraint error if a second row
     ever exists. */
  const clash = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true },
  });
  if (clash && clash.id !== current.id) {
    return { ok: false, message: null, errors: { email: "في حساب تاني بهالبريد" } };
  }

  const passwordHash = await hash(input.newPassword, BCRYPT_COST);

  await prisma.adminUser.update({
    where: { id: current.id },
    data: { email, passwordHash },
  });

  /* Sign out on success, deliberately.

     The session was minted from the OLD credentials and still carries the old
     email in its token. Keeping it would leave the shell greeting them by an
     address that no longer works, and would mean a password change did not
     actually end any session. Signing out makes the new credentials the only
     way back in — which is what changing them is for.

     signOut() throws a redirect, so nothing after this runs. */
  await signOut({ redirectTo: "/admin/login?updated=1" });

  // Unreachable: signOut either redirects or throws.
  return { ok: true, message: null, errors: {} };
}
