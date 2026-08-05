/**
 * Server-side validation for every admin write.
 *
 * The forms are a convenience, not a contract: an action can be posted to
 * directly, so nothing here trusts the shape, the types or the ranges of what
 * arrives. Each schema coerces and re-checks from scratch, and the rules mirror
 * prisma/schema.prisma and the Step 2 seed exactly — an item has EITHER a price
 * OR variants, prices are whole ل.س integers, oldPrice only means anything on an
 * offer.
 *
 * Pure module: no Prisma, no session, no Next imports, so it can be unit-run.
 */
import { z } from "zod";

/* --------------------------------------------------------------------------
   Primitives
   -------------------------------------------------------------------------- */

/** Arabic display name. Trimmed; blank is not a name. */
const displayName = z
  .string()
  .trim()
  .min(1, "الاسم مطلوب")
  .max(120, "الاسم طويل كتير (أقصى ١٢٠ حرف)");

/**
 * A price in whole Syrian pounds.
 *
 * Comes off a form as a string, so it is coerced — but only from something that
 * actually looks like a number: `Number("")` is 0 and `Number("12abc")` is NaN,
 * and neither should quietly become a price.
 */
const price = z
  .string()
  .trim()
  .min(1, "السعر مطلوب")
  .regex(/^\d+$/, "السعر لازم يكون رقم صحيح بالليرة (بدون فواصل أو كسور)")
  .transform((value) => Number(value))
  .refine((value) => Number.isSafeInteger(value), "السعر غير صالح")
  .refine((value) => value > 0, "السعر لازم يكون أكبر من صفر")
  .refine((value) => value <= 100_000_000, "السعر كبير بشكل غير منطقي");

/** A checkbox: present in the FormData means on. */
const flag = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.undefined(), z.null()])
  .transform((value) => value === "on" || value === "true" || value === "1");

const cuid = z.string().trim().min(1, "المعرّف مطلوب").max(64);

/* --------------------------------------------------------------------------
   Slugs
   -------------------------------------------------------------------------- */

/**
 * Turn a category name into a stable, url-safe slug.
 *
 * Matches the seed's slugs in spirit: Arabic letters are KEPT (the seeded slugs
 * are Arabic, e.g. "القهوه-الساخنه"), spaces become hyphens, and the
 * spelling-variant folding mirrors the public search normalizer so "القهوة" and
 * "القهوه" cannot produce two different slugs for the same section.
 */
export function slugify(name: string): string {
  const folded = name
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    // Anything that is not an Arabic letter, a latin letter or a digit becomes
    // a separator. Keeps the result safe in a URL and in a CSS id selector.
    .replace(/[^ء-يa-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // A name made entirely of punctuation would slugify to "" and break the
  // unique index; fall back to something stable and obviously generated.
  return folded || `category-${Date.now()}`;
}

/* --------------------------------------------------------------------------
   Categories
   -------------------------------------------------------------------------- */

export const categoryCreateSchema = z.object({
  name: displayName,
});

export const categoryRenameSchema = z.object({
  id: cuid,
  name: displayName,
});

export const categoryDeleteSchema = z.object({
  id: cuid,
  /**
   * How many items the owner was shown when they confirmed.
   *
   * The action refuses unless this matches the live count, so a cascade can
   * never delete more than the number the confirmation dialog actually named —
   * even if something changed between the page render and the click.
   */
  confirmItemCount: z
    .string()
    .trim()
    .regex(/^\d+$/, "تأكيد غير صالح")
    .transform((value) => Number(value)),
});

export const categoryMoveSchema = z.object({
  id: cuid,
  direction: z.enum(["up", "down"]),
});

/* --------------------------------------------------------------------------
   Items
   -------------------------------------------------------------------------- */

const variantSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "اسم الحجم مطلوب")
    .max(60, "اسم الحجم طويل كتير"),
  price,
});

/**
 * The raw item form, before the either/or rule is applied.
 *
 * `pricingMode` is what the UI toggle sets. It decides which of the two price
 * shapes is read, so a stale value left in the hidden single-price input can
 * never leak into a variant item (or the reverse).
 */
const itemBaseSchema = z.object({
  name: displayName,
  desc: z.string().trim().max(400, "الوصف طويل كتير (أقصى ٤٠٠ حرف)").default(""),
  categoryId: cuid,
  pricingMode: z.enum(["single", "variants"]),
  price: z.string().optional(),
  variants: z.array(variantSchema).default([]),
  available: flag,
  featured: flag,
  offer: flag,
  oldPrice: z.string().optional(),
});

/** What a validated item write looks like — exactly what Prisma will store. */
export type ItemInput = {
  name: string;
  desc: string;
  categoryId: string;
  price: number | null;
  variants: { label: string; price: number }[];
  available: boolean;
  featured: boolean;
  offer: boolean;
  oldPrice: number | null;
};

/**
 * The either/or rule and the offer rule, enforced together because they
 * interact: oldPrice is compared against the LIVE price, which only exists on a
 * single-price item.
 */
export const itemSchema = itemBaseSchema.transform((raw, ctx): ItemInput => {
  let singlePrice: number | null = null;
  let variants: { label: string; price: number }[] = [];

  if (raw.pricingMode === "single") {
    const parsed = price.safeParse(raw.price ?? "");
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: parsed.error.issues[0]?.message ?? "السعر غير صالح",
      });
    } else {
      singlePrice = parsed.data;
    }
    // Anything sitting in the variants field is discarded, not merged: an item
    // must never end up with both.
  } else {
    if (raw.variants.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "لازم تضيف حجم واحد على الأقل، أو ترجع لسعر مفرد",
      });
    }

    const seen = new Set<string>();
    for (const [index, variant] of raw.variants.entries()) {
      const key = variant.label.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["variants", index, "label"],
          message: `الحجم "${variant.label}" مكرر`,
        });
      }
      seen.add(key);
    }
    variants = raw.variants;
  }

  /* oldPrice is display-only and only meaningful on an offer. With the offer
     toggle off it is CLEARED rather than kept, so a stale "was" price can never
     reappear the next time the item goes on offer. */
  let oldPrice: number | null = null;
  if (raw.offer) {
    const typed = (raw.oldPrice ?? "").trim();
    if (typed !== "") {
      const parsed = price.safeParse(typed);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          path: ["oldPrice"],
          message: parsed.error.issues[0]?.message ?? "السعر القديم غير صالح",
        });
      } else if (singlePrice !== null && parsed.data <= singlePrice) {
        // "Was 500, now 600" is not a discount — it misleads the customer.
        ctx.addIssue({
          code: "custom",
          path: ["oldPrice"],
          message: "السعر القديم لازم يكون أعلى من السعر الحالي",
        });
      } else {
        oldPrice = parsed.data;
      }
    }
  }

  return {
    name: raw.name,
    desc: raw.desc,
    categoryId: raw.categoryId,
    price: singlePrice,
    variants,
    available: raw.available,
    featured: raw.featured,
    offer: raw.offer,
    oldPrice,
  };
});

export const itemUpdateSchema = z.object({ id: cuid });

export const itemDeleteSchema = z.object({ id: cuid });

export const itemMoveSchema = z.object({
  id: cuid,
  direction: z.enum(["up", "down"]),
});

/* --------------------------------------------------------------------------
   FormData helpers
   -------------------------------------------------------------------------- */

/**
 * Pull the repeated variant rows out of a FormData.
 *
 * The editor posts them as `variantLabel` / `variantPrice` pairs in DOM order,
 * so the array index IS the sortOrder the owner arranged. Rows left completely
 * blank are dropped rather than rejected — that is what an untouched spare row
 * at the bottom of the editor looks like.
 */
export function readVariants(formData: FormData): { label: string; price: string }[] {
  const labels = formData.getAll("variantLabel").map(String);
  const prices = formData.getAll("variantPrice").map(String);

  return labels
    .map((label, index) => ({ label: label.trim(), price: (prices[index] ?? "").trim() }))
    .filter((row) => row.label !== "" || row.price !== "");
}

/** Flatten zod issues into `field -> first message`, for rendering beside inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
