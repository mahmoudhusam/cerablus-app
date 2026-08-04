/**
 * The on-brand "nothing here" block: the tinted Cerablus mark, a heading and a
 * hint. Used for an empty search result and — with `variant="cart"`, which
 * drops the dashed frame — for an empty cart drawer.
 */
export function EmptyState({
  title,
  hint,
  variant,
}: {
  title: string;
  hint: string;
  variant?: "cart";
}) {
  return (
    <div className={variant === "cart" ? "empty empty-cart" : "empty"}>
      <span className="empty-mark" aria-hidden="true" />
      <h2>{title}</h2>
      <p>{hint}</p>
    </div>
  );
}
