import Link from "next/link";
import type { ReactNode } from "react";

import { CerablusMark } from "@/components/brand/CerablusMark";

/**
 * The sticky brand header, shared by both public pages.
 *
 * `children` is the actions slot on the inline-end side: the landing page puts
 * a bare WhatsApp CTA there, the menu page puts the cart button beside it.
 */
export function SiteHeader({ children }: { children: ReactNode }) {
  return (
    <header>
      <div className="wrap nav">
        <Link className="logo" href="/">
          <span className="mark">
            <span className="cmark">
              <CerablusMark />
            </span>
          </span>
          <span className="name">Cerablus</span>
        </Link>
        {children}
      </div>
    </header>
  );
}
