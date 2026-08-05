"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button that asks first.
 *
 * Nothing destructive in the admin is one click: the button confirms, and the
 * server re-checks anyway (see deleteCategoryAction's count check). Uses the
 * browser's own confirm() rather than a modal — it cannot be mis-styled into
 * invisibility, it traps focus for free, and it works before hydration finishes
 * because the form still posts normally without it.
 */
export function ConfirmSubmit({
  message,
  children,
  className = "admin-btn admin-btn-danger",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/** A plain submit button that reflects the form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  className = "admin-btn",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
