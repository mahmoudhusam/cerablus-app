import { CerablusMark } from "@/components/brand/CerablusMark";
import { ADDRESS, HOURS, MAPS_URL, formatPhone } from "@/lib/business";
import { plainOrderHref } from "@/lib/menu-order";

/**
 * The dark green footer band — also the site's contact section.
 *
 * `id="hours"` on the landing page only: it is the target of the hero's
 * أوقات الدوام button, and an id must not be duplicated across the two pages.
 *
 * Takes the PHONE rather than a finished href, and derives both the wa.me links
 * and the printed number from it. That is what makes the number a customer
 * reads and the number their phone actually dials the same value by
 * construction — there is no second place to update.
 *
 * The links here are bare chat links (no pre-filled order): the cart's own
 * button in the drawer is the one that carries an order.
 */
export function SiteFooter({ phone, id }: { phone: string; id?: string }) {
  const chatHref = plainOrderHref(phone);

  return (
    <footer id={id}>
      <div className="wrap">
        <div className="word">
          <span className="cmark">
            <CerablusMark />
          </span>
          Cerablus<b>.</b>
        </div>

        <div className="meta">
          <p>{HOURS}</p>
          <p>
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer">
              {ADDRESS}
            </a>
          </p>
          {/* dir="ltr" so the + and the digit groups read in the right order
              inside an RTL paragraph; the label beside it stays Arabic. */}
          <p>
            <a className="footer-phone" href={chatHref} target="_blank" rel="noopener noreferrer">
              <span dir="ltr">{formatPhone(phone)}</span>
            </a>
          </p>
        </div>

        <a className="wa" href={chatHref} target="_blank" rel="noopener noreferrer">
          اطلب الآن عبر واتساب
        </a>
      </div>
    </footer>
  );
}
