/**
 * Turn a stored Cloudinary URL into a right-sized delivery URL.
 *
 * Pure and client-safe: no SDK, no secret, no server imports — the public cards
 * render inside the menu page's client tree.
 *
 * WHY THIS EXISTS
 * The owner photographs a slice of kunafa on a phone: a 4 MB, 3024×4032
 * PORTRAIT JPEG. The card slot is a 16:10 landscape box about 300px wide. Left
 * alone, every customer would download the full 4 MB and the browser would
 * squash a tall photo into a wide box. These transformations fix both without
 * anyone touching the original.
 *
 *   f_auto  — serve AVIF/WebP to browsers that take it, JPEG to the rest.
 *   q_auto  — let Cloudinary pick the quality that still looks right.
 *   c_fill  — fill the box exactly, cropping the overflow.
 *   g_auto  — and choose WHAT to crop to by content, so a portrait photo keeps
 *             the food rather than the ceiling. This is the piece that makes 3:4
 *             phone photos land correctly in a 16:10 card with no manual work.
 *   ar_…    — the target aspect ratio per surface.
 *   w_…     — the width, which srcset varies for the screen.
 *
 * The stored URL keeps NO transformation, so changing any of this is a code
 * change, not a re-upload.
 */

/** Where an image is being shown; each surface has its own shape. */
export type ImagePreset = "card" | "hero";

/* The card is a 16:10 landscape tile; the hero panel is near-square (it is
   `aspect-ratio: 1` on mobile and a tall block on desktop). */
const PRESETS: Record<ImagePreset, { ratio: string; widths: number[] }> = {
  card: { ratio: "ar_16:10", widths: [300, 600, 900] },
  hero: { ratio: "ar_1:1", widths: [600, 900, 1200] },
};

const BASE = "f_auto,q_auto,c_fill,g_auto";

/** The marker that tells us a URL is a Cloudinary delivery URL we can transform. */
const UPLOAD_MARKER = "/image/upload/";

function withTransformation(url: string, transformation: string): string {
  const at = url.indexOf(UPLOAD_MARKER);
  // Not a Cloudinary URL (a legacy value, or something hand-entered long ago):
  // hand it back untouched rather than corrupting it. The card's broken-image
  // fallback still covers it if it does not load.
  if (at === -1) return url;

  const head = url.slice(0, at + UPLOAD_MARKER.length);
  const tail = url.slice(at + UPLOAD_MARKER.length);
  return `${head}${transformation}/${tail}`;
}

/** A single delivery URL at the preset's middle width. */
export function menuImageUrl(url: string, preset: ImagePreset): string {
  const { ratio, widths } = PRESETS[preset];
  const width = widths[Math.floor(widths.length / 2)];
  return withTransformation(url, `${BASE},${ratio},w_${width}`);
}

/**
 * A `srcset` across the preset's widths, so a phone downloads a phone-sized
 * image and a desktop a desktop-sized one. Empty string for a non-Cloudinary
 * URL, which makes the attribute a no-op.
 */
export function menuImageSrcSet(url: string, preset: ImagePreset): string {
  if (!url.includes(UPLOAD_MARKER)) return "";
  const { ratio, widths } = PRESETS[preset];
  return widths
    .map((width) => `${withTransformation(url, `${BASE},${ratio},w_${width}`)} ${width}w`)
    .join(", ");
}

/**
 * What the browser should assume the slot is, before CSS has laid out.
 *
 * Cards sit two-per-row under 760px and in a ~300px grid track above it — the
 * same breakpoint the menu grid uses.
 */
export const IMAGE_SIZES: Record<ImagePreset, string> = {
  card: "(max-width: 760px) 45vw, 300px",
  hero: "(max-width: 760px) 100vw, 440px",
};

/** A small, square thumbnail — used by the admin editor's preview. */
export function adminThumbUrl(url: string): string {
  return withTransformation(url, `${BASE},ar_16:10,w_320`);
}
