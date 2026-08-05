import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * /sitemap.xml — the two public pages.
 *
 * Deliberately NOT a per-item or per-category listing: the menu is one page
 * with client-side filtering, so `/menu#cat-…` anchors are not separate
 * documents and listing them would be noise a crawler has to reconcile.
 *
 * Static on purpose. It could read the menu to derive a lastModified, but that
 * would put a database read on a crawler's request path — exactly what the
 * caching model exists to avoid — for no ranking benefit.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/menu`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
