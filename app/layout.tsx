import type { Metadata, Viewport } from "next";
import { Cairo, IBM_Plex_Sans_Arabic, Sora } from "next/font/google";

import { SITE_URL } from "@/lib/site";

// Design C's three faces. Self-hosted by next/font — same families as the old
// static build's Google Fonts <link>, minus the third-party request and the
// layout shift. Each exposes a CSS variable that styles/styles.css's --f-*
// tokens point at, so the font choice still lives in exactly one place.
import "@/styles/styles.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cerablus Coffee — قهوة مختصة في حلب، سوريا",
    template: "%s — Cerablus Coffee",
  },
  description:
    "قهوة مختصة وحلويات طازة ومأكولات خفيفة في حلب، سوريا. مفتوح من الـ 11 صباحاً حتى 1 ليلاً. تصفّح المنيو وابعت طلبك مباشرة عبر واتساب.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // The site is shared almost entirely as a WhatsApp link, so this preview card
  // is the first thing most customers ever see of it.
  openGraph: {
    type: "website",
    siteName: "Cerablus Coffee",
    locale: "ar_SY",
    images: [{ url: "/og-cover.png", width: 1200, height: 630, alt: "Cerablus Coffee" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0c3d26",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Arabic, right-to-left, for the whole app.
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${plexArabic.variable} ${sora.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
