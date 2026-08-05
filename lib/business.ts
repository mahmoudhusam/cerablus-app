/**
 * The café's real-world details — the ONE place this copy is written down.
 *
 * Pure and client-safe on purpose: no `process.env`, no server-only imports, so
 * the footer can use it whether it renders in the landing page's server tree or
 * inside the menu page's client tree.
 *
 * The PHONE is deliberately NOT here. It comes from CERABLUS_WHATSAPP_PHONE via
 * lib/site.ts (server) and is passed down as a prop, so there is exactly one
 * source for the real number. `formatPhone()` below only turns those same
 * digits into something readable — it never carries a number of its own.
 */

/** Kicker / tagline used in the hero and in metadata. */
export const TAGLINE = "قهوة مختصة — سوريا";

/** The city, for the menu page's kicker and the SEO copy. */
export const CITY = "حلب";

/** Opening hours, as the café states them. Crosses midnight. */
export const HOURS = "من الـ 11 صباحاً حتى 1 ليلاً";

/**
 * The same hours in schema.org syntax, for whenever structured data is added.
 * "Mo-Su 11:00-01:00" is the correct encoding for a span that crosses midnight:
 * the closing time is simply smaller than the opening time.
 */
export const HOURS_SCHEMA_ORG = "Mo-Su 11:00-01:00";

export const ADDRESS = "حلب – شارع النيل – مقابل مفرق باريس";

/**
 * A plain Google Maps *search* link rather than a pin.
 *
 * No coordinates are invented here: this hands Maps the address as written and
 * lets it resolve, which is honest about what we actually know. Swap in a real
 * place link once the café confirms their listing.
 */
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  "Cerablus Coffee حلب شارع النيل مقابل مفرق باريس",
)}`;

/**
 * Render the café's number for humans: 963939426710 -> "+963 939 426 710".
 *
 * Takes the digits it is given — always the value that also builds the wa.me
 * link — so what is displayed can never drift from what is dialled. Anything
 * that is not the expected Syrian shape is shown as a plain "+digits" rather
 * than mangled into a wrong grouping.
 */
export function formatPhone(digits: string): string {
  const clean = digits.replace(/\D/g, "");
  const syrianMobile = /^963(\d{3})(\d{3})(\d{3})$/.exec(clean);
  if (syrianMobile) {
    return `+963 ${syrianMobile[1]} ${syrianMobile[2]} ${syrianMobile[3]}`;
  }
  return `+${clean}`;
}
