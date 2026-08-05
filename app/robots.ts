import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * /robots.txt
 *
 * The origin comes from SITE_URL — the single base-URL source (lib/site.ts,
 * fed by NEXT_PUBLIC_SITE_URL). Pointing the site at the real domain is one
 * environment variable, not a hunt through files.
 *
 * The admin and its API are disallowed. That is politeness for well-behaved
 * crawlers, NOT a security control: /admin is protected by proxy.ts, the
 * dashboard layout and requireAdmin() on every action. Nothing here is load
 * bearing — a crawler that ignores this file still gets redirected to the login.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
