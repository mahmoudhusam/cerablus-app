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
 * Stand-in until the café's real number is configured, carried over from the
 * old static build so the order flow is testable before launch. Digits only,
 * no leading +.
 */
const PLACEHOLDER_PHONE = "970590000000";

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
      "[cerablus] CERABLUS_WHATSAPP_PHONE is not set — every wa.me link uses the placeholder number.",
    );
  }
  return PLACEHOLDER_PHONE;
}
