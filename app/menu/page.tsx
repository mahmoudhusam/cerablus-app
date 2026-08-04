import type { Metadata } from "next";

import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { getMenu } from "@/lib/menu-data";
import { SITE_URL, getWhatsAppPhone } from "@/lib/site";

/* Prerendered and served from the Full Route Cache, regenerated on this
   schedule or on demand by Step 5's revalidateMenu(). The 133 cards are in the
   server-rendered HTML, so the menu is readable before JavaScript loads — and
   Neon is never in a customer's request path.

   A literal, not MENU_REVALIDATE_SECONDS: Next reads segment config exports
   statically at build time and rejects an imported value. Keep the two in step
   — one hour. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "المنيو",
  description:
    "منيو Cerablus Coffee: مشروبات ساخنة وباردة، حلويات ومأكولات خفيفة. ابحث عن صنفك، أضفه للسلة، وابعت طلبك عبر واتساب.",
  alternates: { canonical: `${SITE_URL}/menu` },
  openGraph: {
    title: "المنيو — Cerablus Coffee",
    description:
      "منيو Cerablus Coffee: مشروبات ساخنة وباردة، حلويات ومأكولات خفيفة. اختَر أصنافك وابعت طلبك عبر واتساب.",
    url: `${SITE_URL}/menu`,
  },
};

export default async function MenuPage() {
  const menu = await getMenu();

  // The number is read on the server and handed to the client tree as a prop —
  // it never becomes a NEXT_PUBLIC_* variable, and no other env value travels
  // with it.
  return <MenuBrowser menu={menu} phone={getWhatsAppPhone()} />;
}
