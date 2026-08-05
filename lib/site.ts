/**
 * SERVER ONLY — values the public pages need that do not live in the database.
 *
 * The WhatsApp number is read here and passed DOWN into the client tree as a
 * prop. It is deliberately not a NEXT_PUBLIC_* variable: keeping it server-side
 * means there is exactly one place it comes from, and no other server secret
 * can be swept into the client bundle alongside it.
 *
 * (The number itself is not a secret — it ends up in every wa.me link on the
 * page. The discipline is about where configuration is allowed to enter the
 * client, not about hiding a phone number.)
 */

/**
 * The café's real WhatsApp number, used when CERABLUS_WHATSAPP_PHONE is not
 * set — a local checkout, or a preview deploy whose env vars were forgotten.
 *
 * This is the ONLY literal number in the codebase, and it is a fallback, not
 * the source: the environment variable wins whenever it is present.
 *
 * Digits only, no leading +. The human-readable form is derived from this same
 * value by formatPhone() in lib/business.ts, so the two cannot disagree.
 *
 * It replaces a 970… placeholder carried over from the previous build — the
 * wrong country's dialling code, which would have sent every order nowhere.
 */
const FALLBACK_PHONE = "963939426710";

/**
 * The site's own origin, used to make canonical and Open Graph URLs absolute —
 * crawlers do not run JavaScript, so those have to be real URLs.
 *
 * `https://cerablus.example` is a reserved, never-resolving placeholder,
 * carried over from the old build. Step 7 (deploy + custom domain) sets
 * NEXT_PUBLIC_SITE_URL and this resolves to the real one.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cerablus.example";

/**
 * The café's WhatsApp number, digits only.
 *
 * Non-digits are stripped so a value pasted as "+963 11 123 4567" still yields
 * a working wa.me link rather than a broken one.
 */
export function getWhatsAppPhone(): string {
  const configured = (process.env.CERABLUS_WHATSAPP_PHONE ?? "").replace(/\D/g, "");
  if (configured) return configured;

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[cerablus] CERABLUS_WHATSAPP_PHONE is not set — falling back to the number hard-coded in lib/site.ts.",
    );
  }
  return FALLBACK_PHONE;
}
