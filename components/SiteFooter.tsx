import { CerablusMark } from "@/components/brand/CerablusMark";

/* Hours and address band. Kept here rather than in lib/site.ts so this
   component stays free of any server-only module — it renders inside the menu
   page's client tree as well as the landing page's server tree. */
const HOURS_LINE = "يوميًا ٩ص–١١م · العنوان يُحدّد لاحقًا";

/**
 * The dark green footer band. `id="hours"` on the landing page only — it is the
 * target of the hero's أوقات الدوام button, and an id must not be duplicated
 * across the two pages' markup.
 *
 * `waHref` is a bare chat link (no pre-filled order): the cart's own button in
 * the drawer is the one that carries an order.
 */
export function SiteFooter({ waHref, id }: { waHref: string; id?: string }) {
  return (
    <footer id={id}>
      <div className="wrap">
        <div className="word">
          <span className="cmark">
            <CerablusMark />
          </span>
          Cerablus<b>.</b>
        </div>
        <div className="meta">{HOURS_LINE}</div>
        <a className="wa" href={waHref} target="_blank" rel="noopener noreferrer">
          اطلب الآن عبر واتساب
        </a>
      </div>
    </footer>
  );
}
