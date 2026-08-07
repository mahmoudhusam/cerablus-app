"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type LoginState, loginAction } from "@/app/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="admin-submit" type="submit" disabled={pending}>
      {pending ? "جاري الدخول…" : "دخول"}
    </button>
  );
}

/**
 * The owner's login form.
 *
 * Submits to a server action, so the credentials go straight to the server and
 * the form still works before hydration. Nothing about the failure reaches the
 * client except one generic sentence — see loginAction.
 */
export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {
    error: null,
  });

  return (
    <form className="admin-form" action={formAction} noValidate>
      <label className="admin-field">
        <span>البريد الإلكتروني</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          dir="ltr"
        />
      </label>

      <label className="admin-field">
        <span>كلمة المرور</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
        />
      </label>

      {/* role="alert" so a screen reader hears the failure without hunting. */}
      {state.error ? (
        <p className="admin-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
