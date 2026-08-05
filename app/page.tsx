import Link from "next/link";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CerablusLogotype } from "@/components/brand/CerablusLogotype";
import { HeroArt } from "@/components/landing/HeroArt";
import { PreviewSection } from "@/components/landing/PreviewSection";
import { getMenu } from "@/lib/menu-data";
import { TAGLINE } from "@/lib/business";
import { heroEligibleItems } from "@/lib/menu-format";
import { plainOrderHref } from "@/lib/menu-order";
import { SITE_URL, getWhatsAppPhone } from "@/lib/site";

/* This page is prerendered and served from the Full Route Cache. It is
   regenerated on this schedule, or immediately when Step 5's admin edits call
   revalidateMenu(). A visitor never waits on the database.

   A literal, not MENU_REVALIDATE_SECONDS: Next reads segment config exports
   statically at build time and rejects an imported value. Keep the two in step
   — one hour. */
export const revalidate = 3600;

export const metadata = {
  alternates: { canonical: SITE_URL },
};

export default async function Home() {
  const menu = await getMenu();
  const phone = getWhatsAppPhone();
  // No cart on this page, so the header and footer carry bare chat links: they
  // open a conversation with no pre-filled order, which is the right thing here.
  const chatHref = plainOrderHref(phone);

  return (
    <>
      <SiteHeader>
        <a
          className="order-cta"
          href={chatHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          اطلب عبر واتساب
        </a>
      </SiteHeader>

      <section className="wrap hero">
        <div className="col-text">
          <span className="kick">{TAGLINE}</span>
          {/* headline + logo lockup read as one tight unit, sharing the right
              edge in RTL */}
          <div className="headline">
            <h1>قهوتك تبدأ من</h1>
            <div className="logo-full lockup">
              <CerablusLogotype />
            </div>
          </div>
          <p>
            قهوة مختصّة، حلويات طازة، ومأكولات خفيفة. اختَر من المنيو وابعت طلبك مباشرة
            عبر واتساب.
          </p>
          <div className="actions">
            <Link className="btn-green" href="/menu">
              تصفّح المنيو واطلب
            </Link>
            {/* The hours live in the footer band; there is no separate contact
                section until the client's real address arrives. */}
            <a className="btn-ghost" href="#hours">
              أوقات الدوام
            </a>
          </div>
        </div>

        {/* Slideshow when the menu carries at least two featured photos, the
            logo panel otherwise. Filtering here keeps the landing page's client
            payload to the slides themselves. */}
        <HeroArt eligible={heroEligibleItems(menu.items)} />
      </section>

      <section className="wrap">
        <div className="strip">
          <div>قهوة مختصّة</div>
          <div>
            حلويات <span>يوميًا</span>
          </div>
          <div>
            طلب عبر <span>واتساب</span>
          </div>
          <div>أجواء عصرية</div>
        </div>
      </section>

      <PreviewSection menu={menu} />

      {/* id="hours": the target of the hero's أوقات الدوام button. */}
      <SiteFooter id="hours" phone={phone} />
    </>
  );
}
