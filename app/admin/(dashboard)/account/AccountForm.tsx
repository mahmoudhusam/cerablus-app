"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/admin/ConfirmSubmit";
import {
  type AccountFormState,
  updateAccountAction,
} from "@/app/admin/(dashboard)/account/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/admin-schemas";

/**
 * Change the owner's login email and password.
 *
 * Nothing sensitive is held here: the fields are uncontrolled, the current
 * email arrives as a plain string prop, and no hash or secret is ever sent to
 * the browser. Everything is verified again on the server — this form is a
 * convenience, not the check.
 */
export function AccountForm({ email }: { email: string }) {
  const [state, formAction] = useActionState<AccountFormState, FormData>(
    updateAccountAction,
    { ok: false, message: null, errors: {} },
  );

  const error = (field: string) => state.errors[field];

  return (
    <form className="admin-form" action={formAction} noValidate>
      {state.message ? (
        <p className="admin-flash admin-flash-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <fieldset className="admin-fieldset">
        <legend>تأكيد الهوية</legend>
        <p className="admin-hint">
          لأمانك، لازم تدخل كلمة المرور الحالية قبل ما تغيّر بيانات الدخول.
        </p>

        <label className="admin-field">
          <span>كلمة المرور الحالية</span>
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            dir="ltr"
          />
          {error("currentPassword") ? (
            <em className="admin-field-error">{error("currentPassword")}</em>
          ) : null}
        </label>
      </fieldset>

      <fieldset className="admin-fieldset">
        <legend>بيانات الدخول الجديدة</legend>

        <label className="admin-field">
          <span>البريد الإلكتروني</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={email}
            required
            dir="ltr"
          />
          {error("email") ? <em className="admin-field-error">{error("email")}</em> : null}
        </label>

        <label className="admin-field">
          <span>كلمة المرور الجديدة</span>
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
          />
          {error("newPassword") ? (
            <em className="admin-field-error">{error("newPassword")}</em>
          ) : (
            <em className="admin-hint">
              {MIN_PASSWORD_LENGTH} أحرف على الأقل. كلمة مرور طويلة أقوى من كلمة معقّدة.
            </em>
          )}
        </label>

        <label className="admin-field">
          <span>تأكيد كلمة المرور الجديدة</span>
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            dir="ltr"
          />
          {error("confirmPassword") ? (
            <em className="admin-field-error">{error("confirmPassword")}</em>
          ) : null}
        </label>
      </fieldset>

      <div className="admin-form-actions">
        <SubmitButton pendingLabel="جاري الحفظ…">احفظ بيانات الدخول</SubmitButton>
      </div>

      <p className="admin-hint">
        بعد الحفظ رح ينتهي تسجيل دخولك وترجع لصفحة الدخول، لتسجّل دخول ببياناتك الجديدة.
      </p>
    </form>
  );
}
