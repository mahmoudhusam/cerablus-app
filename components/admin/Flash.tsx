/**
 * The banner shown after a redirecting action (save / delete / a refused move).
 *
 * Server-rendered from the query string rather than held in client state,
 * because those actions end in a redirect — there is no component left to hold
 * a message. `role="status"` for the good news, `role="alert"` for the bad, so
 * a screen reader hears both without either being silent.
 */
export function Flash({
  saved,
  deleted,
  error,
}: {
  saved?: string;
  deleted?: string;
  error?: string;
}) {
  if (error) {
    return (
      <p className="admin-flash admin-flash-error" role="alert">
        {error}
      </p>
    );
  }
  if (saved) {
    return (
      <p className="admin-flash admin-flash-ok" role="status">
        تم حفظ &laquo;{saved}&raquo;. المنيو العام تحدّث.
      </p>
    );
  }
  if (deleted) {
    return (
      <p className="admin-flash admin-flash-ok" role="status">
        تم حذف &laquo;{deleted}&raquo;. المنيو العام تحدّث.
      </p>
    );
  }
  return null;
}
