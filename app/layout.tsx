import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Cerablus Coffee — جرابلس",
  description: "قهوة مختصة — قائمة الطعام والمشروبات",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Arabic, right-to-left. The approved design C tokens (styles/styles.css)
  // are wired up in Step 3, not here.
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
